

size = 512

# resize all images in the 'sdf' folder to size x size
import cv2
import os
sdf_folder = 'sdf'
for filename in os.listdir(sdf_folder):
    if filename.endswith('.png') or filename.endswith('.jpg'):
        path = os.path.join(sdf_folder, filename)
        img = cv2.imread(path, cv2.IMREAD_GRAYSCALE)
        img_resized = cv2.resize(img, (size, size), interpolation=cv2.INTER_AREA)
        cv2.imwrite(path, img_resized)