"""
图像生成功能模块

提供图像生成能力的备用接口
"""

import os
import requests
import time
from pathlib import Path
from typing import Optional, Dict, Any, List
from .models import ModelRegistry
import base64


def generate_image_with_nanobanana(prompt: str, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    使用可能的图像生成模型生成图像
    如果模型不支持图像生成功能，则提供图像生成描述替代
    """
    # 获取图像相关模型配置
    registry = ModelRegistry()
    image_models = [
        m
        for m in registry.list()
        if "nano" in m.key.lower()
        or "image" in m.key.lower()
        or "banana" in m.key.lower()
        or "gemini" in m.key.lower()
    ]

    if not image_models:
        return {
            "success": False,
            "error": "未找到支持图像的模型 (期望包含 'nano', 'image', 'banana', 或 'gemini' 的模型名)",
            "generated_files": [],
        }

    model = image_models[0]  # 使用第一个图像相关模型

    # 检查API密钥
    api_key = os.getenv(model.api_key_env or "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": f"环境变量 {model.api_key_env or 'GEMINI_API_KEY'} 未设置，无法调用API",
            "generated_files": [],
        }

    # 根据模型类型调整端点
    model_id = model.model_id or "gemini-pro-vision"

    headers = {"Content-Type": "application/json"}

    # 构建请求 payload
    prompt_text = f"Description of image to generate: {prompt}\n\nIf you can generate images, create a relevant visual. If not, describe what visual elements, colors, shapes, and compositions would work best for this image. Respond in Chinese."

    payload = {
        "contents": [{"role": "user", "parts": [{"text": prompt_text}]}],
        "generationConfig": {"candidateCount": 1, "maxOutputTokens": 2048, "temperature": 0.8},
        "safetySettings": [
            {"category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_LOW_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_LOW_AND_ABOVE"},
            {"category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_LOW_AND_ABOVE"},
            {"category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_LOW_AND_ABOVE"},
        ],
    }

    # 确定API端点
    if "gemini" in model_id.lower() or "pro-vision" in model_id.lower():
        api_endpoint = "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent"
    else:
        api_endpoint = (
            f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:generateContent"
        )

    url = f"{api_endpoint}?key={api_key}"

    print("🎨 调用AI模型尝试图像生成...")
    print(f"   模型: {model_id}")
    print(f"   提示: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")

    try:
        # 发送请求
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 200:
            data = response.json()

            # 检查响应结构
            if "candidates" in data and len(data["candidates"]) > 0:
                candidate = data["candidates"][0]

                if "content" in candidate and "parts" in candidate["content"]:
                    all_texts = []
                    inline_images = []

                    # 提取文本和图像数据
                    for part in candidate["content"]["parts"]:
                        if "text" in part:
                            all_texts.append(part["text"])
                        elif "inlineData" in part:
                            inline_images.append(part["inlineData"])

                    # 创建输出目录
                    output_path = (
                        Path(output_dir) if output_dir else Path.cwd() / "generated_images"
                    )
                    output_path.mkdir(exist_ok=True)
                    generated_files = []

                    # 处理内联图像数据
                    if inline_images:
                        for idx, img_data in enumerate(inline_images):
                            if "data" in img_data:
                                try:
                                    # 解码base64图像数据
                                    image_bytes = base64.b64decode(img_data["data"])

                                    # 确定文件类型
                                    mime_type = img_data.get("mimeType", "image/png")
                                    if "jpeg" in mime_type or "jpg" in mime_type:
                                        ext = "jpg"
                                    elif "png" in mime_type:
                                        ext = "png"
                                    elif "gif" in mime_type:
                                        ext = "gif"
                                    else:
                                        ext = "png"

                                    # 保存图像文件
                                    timestamp = int(time.time())
                                    filename = f"generated_image_{timestamp}_{idx + 1:02d}.{ext}"
                                    filepath = output_path / filename

                                    with open(filepath, "wb") as f:
                                        f.write(image_bytes)

                                    # 尝试自动打开
                                    try:
                                        import subprocess

                                        subprocess.run(["open", str(filepath)], timeout=3)
                                    except Exception:
                                        pass  # 可选操作，失败不重要

                                    generated_files.append(str(filepath.absolute()))
                                    print(f"   ✅ 图像已保存: {filename}")

                                except Exception as e:
                                    print(f"   ⚠️ 图像解码失败: {e}")
                    else:
                        print("   ℹ️ 模型未生成图像数据（此模型可能不直接支持图像生产）")

                    # 如果有文本，则保存描述
                    timestamp = int(time.time())  # 修复：确保在使用前定义
                    if all_texts:
                        desc_filename = f"image_description_{timestamp}.txt"
                        desc_filepath = output_path / desc_filename

                        with open(desc_filepath, "w", encoding="utf-8") as f:
                            f.write(f"图像生成请求:\n{prompt}\n\n")
                            f.write(f"AI模型响应:\n{chr(10).join(all_texts)}\n\n")
                            f.write(f"使用模型: {model_id}\n")

                        generated_files.append(str(desc_filepath.absolute()))
                        print(f"   💬 描述已保存: {desc_filename}")

                    if generated_files:
                        return {
                            "success": True,
                            "message": f"生成完成 ({len(generated_files)} 个文件)",
                            "generated_files": generated_files,
                        }
                    else:
                        # 模型不支持图像生成功能的情况下生成一个虚拟提示
                        timestamp = int(time.time())  # 需要定义timestamp
                        virtual_filename = f"image_generation_unavailable_{timestamp}.txt"
                        virtual_filepath = output_path / virtual_filename

                        with open(virtual_filepath, "w", encoding="utf-8") as f:
                            f.write("图像生成不可用\n")
                            f.write(f"模型: {model_id}\n")
                            f.write(f"请求: {prompt}\n")
                            f.write("\n此模型当前不支持直接图像生成功能.\n")
                            f.write("请考虑:\n")
                            f.write("- 使用专门的图像生成API (如 DALL-E, Midjourney)\n")
                            f.write("- 将此作为概念图请求发送给人类设计师\n")
                            f.write("- 配置支持图像生成功能的MCP扩展\n")

                        return {
                            "success": True,
                            "message": "模型不支持直接图像生成，已创建建议说明",
                            "generated_files": [str(virtual_filepath.absolute())],
                        }
                else:
                    return {
                        "success": False,
                        "error": f"响应内容格式异常: {str(data)[:200]}...",
                        "generated_files": [],
                    }
            else:
                return {
                    "success": False,
                    "error": f"API响应中无候选人数据: {str(data)[:200]}...",
                    "generated_files": [],
                }
        else:
            # 处理API错误
            error_detail = response.text
            if "API key not valid" in response.text:
                error_msg = "API密钥无效或未授权该模型。请检查GEMINI_API_KEY设置。"
            elif "quota exceeded" in response.text.lower():
                error_msg = "API配额已用完。请检查计费设置。"
            elif "model_not_found" in response.text.lower():
                error_msg = f"模型 '{model_id}' 无法找到。可能需要付费计划或已停用。"
            else:
                error_msg = f"API错误 {response.status_code}: {error_detail[:200]}..."

            return {"success": False, "error": f"API请求失败: {error_msg}", "generated_files": []}

    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": "API请求超时(120秒)。可能是模型处理复杂或当前负载过高。",
            "generated_files": [],
        }
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络请求失败: {str(e)}", "generated_files": []}
    except Exception as e:
        return {
            "success": False,
            "error": f"生成图像时发生未知错误: {str(e)}",
            "generated_files": [],
        }


def generate_image_with_imagen(prompt: str, output_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    使用 Imagen 4 Ultra 模型生成图像 (Predict API)

    Args:
        prompt: 图像描述
        output_dir: 输出目录

    Returns:
        包含 success, message/error, generated_files 的字典
    """
    registry = ModelRegistry()
    imagen_model = registry.get("imagen-4-ultra")

    if not imagen_model:
        return {
            "success": False,
            "error": "未找到 imagen-4-ultra 模型配置",
            "generated_files": [],
        }

    api_key = os.getenv(imagen_model.api_key_env or "GEMINI_API_KEY")
    if not api_key:
        return {
            "success": False,
            "error": f"环境变量 {imagen_model.api_key_env or 'GEMINI_API_KEY'} 未设置",
            "generated_files": [],
        }

    model_id = imagen_model.model_id or "imagen-4.0-generate-preview-05-20"

    api_endpoint = imagen_model.api_base_url or (
        f"https://generativelanguage.googleapis.com/v1beta/models/{model_id}:predict"
    )

    url = f"{api_endpoint}?key={api_key}"
    headers = {"Content-Type": "application/json"}

    payload = {"instances": [{"prompt": prompt}], "parameters": {"sampleCount": 1}}

    print("🎨 调用 Imagen 4 Ultra 生成图像...")
    print(f"   模型: {model_id}")
    print(f"   提示: {prompt[:50]}{'...' if len(prompt) > 50 else ''}")

    try:
        response = requests.post(url, headers=headers, json=payload, timeout=120)

        if response.status_code == 200:
            data = response.json()

            if "predictions" in data and len(data["predictions"]) > 0:
                output_path = Path(output_dir) if output_dir else Path.cwd() / "generated_images"
                output_path.mkdir(exist_ok=True)
                generated_files = []

                for idx, prediction in enumerate(data["predictions"]):
                    if "bytesBase64Encoded" in prediction:
                        try:
                            image_bytes = base64.b64decode(prediction["bytesBase64Encoded"])

                            mime_type = prediction.get("mimeType", "image/png")
                            if "jpeg" in mime_type or "jpg" in mime_type:
                                ext = "jpg"
                            elif "png" in mime_type:
                                ext = "png"
                            elif "gif" in mime_type:
                                ext = "gif"
                            else:
                                ext = "png"

                            timestamp = int(time.time())
                            filename = f"imagen_{timestamp}_{idx + 1:02d}.{ext}"
                            filepath = output_path / filename

                            with open(filepath, "wb") as f:
                                f.write(image_bytes)

                            try:
                                import subprocess

                                subprocess.run(["open", str(filepath)], timeout=3)
                            except Exception:
                                pass

                            generated_files.append(str(filepath.absolute()))
                            print(f"   ✅ 图像已保存: {filename}")

                        except Exception as e:
                            print(f"   ⚠️ 图像解码失败: {e}")
                    else:
                        print("   ⚠️ 预测结果中无图像数据")

                if generated_files:
                    return {
                        "success": True,
                        "message": f"Imagen 生成完成 ({len(generated_files)} 个文件)",
                        "generated_files": generated_files,
                    }
                else:
                    return {
                        "success": False,
                        "error": "Imagen 未生成有效图像",
                        "generated_files": [],
                    }
            else:
                return {
                    "success": False,
                    "error": f"API响应中无 predictions 数据: {str(data)[:200]}",
                    "generated_files": [],
                }
        else:
            error_detail = response.text
            if "API key not valid" in response.text:
                error_msg = "API密钥无效。请检查GEMINI_API_KEY设置。"
            elif "quota exceeded" in response.text.lower():
                error_msg = "API配额已用完。请检查计费设置。"
            elif "model_not_found" in response.text.lower():
                error_msg = f"模型 '{model_id}' 无法找到。"
            else:
                error_msg = f"API错误 {response.status_code}: {error_detail[:200]}"

            return {
                "success": False,
                "error": f"Imagen API请求失败: {error_msg}",
                "generated_files": [],
            }

    except requests.exceptions.Timeout:
        return {
            "success": False,
            "error": "Imagen API请求超时(120秒)",
            "generated_files": [],
        }
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": f"网络请求失败: {str(e)}", "generated_files": []}
    except Exception as e:
        return {
            "success": False,
            "error": f"Imagen 生成图像时发生未知错误: {str(e)}",
            "generated_files": [],
        }


def handle_image_generation(args: List[str]) -> Dict[str, Any]:
    """
    图像生成命令处理器
    双引擎方案: Imagen 4 Ultra 优先，nanobanana 降级
    """
    if not args:
        return {
            "success": False,
            "error": '请提供图像描述，例如：cli-switch image "一只可爱的橘猫在阳光下玩耍"',
            "generated_files": [],
        }

    prompt = " ".join(args)

    print("🌟 OpenClaw 图像生成功能")
    print("=" * 40)

    registry = ModelRegistry()

    image_models = [
        m
        for m in registry.list()
        if any(x in m.key.lower() for x in ["imagen", "nano", "banana", "image"])
    ]

    if image_models:
        print(f"🔍 找到 {len(image_models)} 个图像模型: {', '.join([m.key for m in image_models])}")
    else:
        print("💡 可用模型: " + ", ".join([m.key for m in registry.list()]))
        print("⚠️ 未找到图像专用模型，尝试通用模型...")
        all_models = registry.list()
        if all_models:
            image_models = [all_models[0]]
        else:
            return {"success": False, "error": "无可用模型", "generated_files": []}

    has_imagen = any("imagen" in m.key.lower() for m in image_models)
    has_nanobanana = any("nano" in m.key.lower() or "banana" in m.key.lower() for m in image_models)

    result = None

    if has_imagen:
        print("🔧 优先使用 Imagen 4 Ultra...")
        result = generate_image_with_imagen(prompt)

        if result["success"]:
            print("🎉 Imagen 图像生成完成！")
            for file_path in result["generated_files"]:
                print(f"   ✅ {Path(file_path).name}")
            return result
        else:
            print(f"   ⚠️ Imagen 失败: {result['error']}")
            if has_nanobanana:
                print("🔄 降级到 nanoBanana...")
            else:
                print("💡 提示: 请检查 GEMINI_API_KEY 设置或网络连接。")
                return result

    if has_nanobanana or result is None:
        print("🔧 使用 nanoBanana 生成图像...")
        result = generate_image_with_nanobanana(prompt)

        if result["success"]:
            print("🎉 nanoBanana 图像生成完成！")
            for file_path in result["generated_files"]:
                print(f"   ✅ {Path(file_path).name}")
        else:
            print("⚠️ 图像生成遇到问题:")
            print(f"   ❌ {result['error']}")
            print("💡 提示: 请检查 GEMINI_API_KEY 设置或网络连接。")

    return result


def attempt_image_generation_standard(
    model_id: str, api_key: str, prompt: str, output_dir: str
) -> Dict[str, Any]:
    """标准图像生成调用 - 暂无实现"""
    # 这是备用函数，目前不实现
    return {"success": False, "error": "该模型不支持标准图像生成API", "generated_files": []}
