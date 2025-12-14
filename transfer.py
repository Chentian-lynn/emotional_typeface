import cv2
import numpy as np

def transfer_sdf(img):
    # 二值化（阈值可调）
    _, mask = cv2.threshold(img, 127, 255, cv2.THRESH_BINARY)

    # 计算前景（白色）的距离场
    dist_white = cv2.distanceTransform(mask, cv2.DIST_L2, 5)
    # 计算背景（黑色）的距离场
    dist_black = cv2.distanceTransform(255 - mask, cv2.DIST_L2, 5)

    # 白色区域正距离，黑色区域负距离
    sdf = dist_white - dist_black

    # 归一化到[-1, 1]范围,
    sdf = sdf / np.max(np.abs(sdf))

    return ((sdf + 1) / 2 * 255).astype(np.uint8)

# 可选：可视化保存
# cv2.imwrite('sdf_visual.png', ((sdf + 1) / 2 * 255).astype(np.uint8))

letter_list = ['H']
emotion_zh = ['高兴', '恶心', '生气', '伤心', '惊讶', '惊恐', '中立']
emotion_en = ['happy', 'disgusted', 'angry', 'sad', 'surprised', 'fearful', 'neutral']
for letter in letter_list:
    for i, emotion in enumerate(emotion_zh):
        # 读取灰度图（黑白）
        img = cv2.imread(f'origin/{letter}/{letter} {emotion}.png', cv2.IMREAD_GRAYSCALE)
        sdf = transfer_sdf(img)
        cv2.imwrite(f'sdf/{letter}_{emotion_en[i]}.png', sdf)

