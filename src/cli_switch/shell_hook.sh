# Shell Hook for cli-switch
# 在 precmd 中自动 source TTY 专属的 .env 文件
#
# 安装：cli-switch hook install
# 卸载：cli-switch hook uninstall
#
# 特性：
# - 使用缓存检查，避免重复 source
# - 静默失败，回退到全局配置
# - 性能优化 < 10ms

_cli_switch_precmd() {
    # 获取当前 TTY 并转换名称 (/ -> _)
    local tty_name
    tty_name=$(tty 2>/dev/null | tr '/' '_')

    # 如果无法获取 TTY，静默退出
    if [ -z "$tty_name" ]; then
        return 0
    fi

    local state_env="$HOME/.cli-switch/sessions/${tty_name}.env"

    # 检查文件是否存在
    if [ -f "$state_env" ]; then
        # 使用缓存检查，避免重复 source
        # 检查：1) TTY 是否变化 2) 文件 mtime 是否变化
        local current_mtime
        if [[ "$OSTYPE" == "darwin"* ]]; then
            # macOS
            current_mtime=$(stat -f%m "$state_env" 2>/dev/null)
        else
            # Linux
            current_mtime=$(stat -c%Y "$state_env" 2>/dev/null)
        fi

        if [ "$_CLI_SWITCH_LAST_TTY" != "$tty_name" ] || [ "$_CLI_SWITCH_LAST_MTIME" != "$current_mtime" ]; then
            # 状态变化，需要重新 source
            if source "$state_env" 2>/dev/null; then
                export _CLI_SWITCH_LAST_TTY="$tty_name"
                export _CLI_SWITCH_LAST_MTIME="$current_mtime"
            fi
        fi
    else
        # 文件不存在，清除缓存
        unset _CLI_SWITCH_LAST_TTY
        unset _CLI_SWITCH_LAST_MTIME
    fi
}

# 安装 hook 函数
_cli_switch_install_hook() {
    # 检查是否已安装
    if [[ "$(declare -f _cli_switch_precmd)" != "" ]]; then
        # 钩子已存在，检查是否已添加到 precmd_functions
        if [[ "${precmd_functions[@]}" =~ "_cli_switch_precmd" ]]; then
            echo "cli-switch hook 已安装"
            return 0
        fi
    fi

    # 添加到 precmd_functions
    precmd_functions+=(_cli_switch_precmd)
    echo "cli-switch hook 已安装"
}

# 卸载 hook 函数
_cli_switch_uninstall_hook() {
    # 从 precmd_functions 移除
    local i
    for i in "${!precmd_functions[@]}"; do
        if [[ "${precmd_functions[$i]}" == "_cli_switch_precmd" ]]; then
            unset 'precmd_functions[$i]'
            break
        fi
    done

    # 重新索引数组
    precmd_functions=("${precmd_functions[@]}")

    echo "cli-switch hook 已卸载"
}

# 自动安装
_cli_switch_install_hook

# 导出函数供子 shell 使用
export -f _cli_switch_precmd 2>/dev/null || true
