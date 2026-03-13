"""
文件锁 - 基于 fcntl.flock 的跨进程排他锁

提供 context manager 接口，用于保护共享配置文件的读-改-写临界区。
进程崩溃时内核自动释放 advisory lock，不会产生死锁残留。

锁文件统一存放在 ~/.cli-switch/locks/ 目录下。
"""

import errno
import fcntl
import time
from pathlib import Path


class LockTimeout(Exception):
    """获取文件锁超时"""

    pass


class FileLock:
    """基于 fcntl.flock 的文件锁 context manager

    使用非阻塞尝试 + 循环重试 + monotonic 超时检测。
    默认超时 5 秒，50ms 重试间隔。

    用法:
        lock = FileLock(Path("~/.cli-switch/locks/claude.lock"))
        with lock:
            # 临界区：读-改-写配置文件
            ...
    """

    def __init__(self, lock_path: Path, timeout: float = 5.0, retry_interval: float = 0.05):
        """
        Args:
            lock_path: 锁文件路径
            timeout: 获取锁的超时时间（秒），0 表示不等待
            retry_interval: 重试间隔（秒）
        """
        self.lock_path = lock_path
        self.timeout = timeout
        self.retry_interval = retry_interval
        self._fd = -1  # 文件描述符，-1 表示未持有锁
        self._file_obj = None  # type: ignore

    def acquire(self) -> None:
        """获取排他锁，超时抛出 LockTimeout"""
        self.lock_path.parent.mkdir(parents=True, exist_ok=True)
        f = open(self.lock_path, "w")
        self._file_obj = f
        self._fd = f.fileno()

        deadline = time.monotonic() + self.timeout
        while True:
            try:
                fcntl.flock(self._fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
                return  # 成功获取锁
            except OSError as e:
                if e.errno not in (errno.EACCES, errno.EAGAIN):
                    self._close()
                    raise
                if time.monotonic() >= deadline:
                    self._close()
                    raise LockTimeout(f"获取文件锁超时 ({self.timeout}s): {self.lock_path}")
                time.sleep(self.retry_interval)

    def release(self) -> None:
        """释放锁"""
        if self._fd >= 0:
            try:
                fcntl.flock(self._fd, fcntl.LOCK_UN)
            except OSError:
                pass
            finally:
                self._close()

    def _close(self) -> None:
        """关闭文件对象并重置状态"""
        self._fd = -1
        if self._file_obj is not None:
            try:
                self._file_obj.close()
            except OSError:
                pass
            self._file_obj = None

    def __enter__(self) -> "FileLock":
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb) -> bool:  # type: ignore
        self.release()
        return False  # 不吞异常


def get_lock(name: str, timeout: float = 5.0) -> FileLock:
    """获取预配置的 FileLock 实例

    锁文件统一放在 ~/.cli-switch/locks/ 目录下。

    Args:
        name: 锁名称（如 "claude", "gemini", "codex", "hooks", "sessions"）
        timeout: 超时时间（秒）

    Returns:
        FileLock 实例
    """
    lock_dir = Path.home() / ".cli-switch" / "locks"
    lock_path = lock_dir / f"{name}.lock"
    return FileLock(lock_path, timeout=timeout)
