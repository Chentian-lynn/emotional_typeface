import cv2
import numpy as np

input_image_1 = 'image1.png'
input_image_2 = 'image2.png'
output_image = 'blended_image.png'

def sdf_blend_images(img1_path, img2_path, ratio=0.5):
    # 读取两张sdf图像
    img1 = cv2.imread(img1_path, cv2.IMREAD_GRAYSCALE)
    img2 = cv2.imread(img2_path, cv2.IMREAD_GRAYSCALE)
    if img1.shape != img2.shape:
        raise ValueError("Input images must have the same dimensions")
    # 提取灰度
    gray1 = img1.astype(np.float32) / 255.0
    gray2 = img2.astype(np.float32) / 255.0
    # 线性混合
    blended_gray = (1 - ratio) * gray1 + ratio * gray2
    # 得到二值图
    _, binary_mask = cv2.threshold(blended_gray, 0.5, 1.0, cv2.THRESH_BINARY)
    # 转换回uint8
    blended_image = (binary_mask * 255).astype(np.uint8)
    cv2.imwrite(output_image, blended_image)
    return blended_image

sdf_blend_images(input_image_1, input_image_2, ratio=0.7)