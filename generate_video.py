import cv2
import numpy as np
from moviepy.video.io.ImageSequenceClip import ImageSequenceClip

# float d = texture2D(sdfTex[i], uv).r - 0.5;
# if (d < 0.0) d = -(pow(-d, 0.7));
# sdf += (d + 0.5) * weights[i];

letter_list = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z']
emotion_en = ['neutral', 'happy', 'disgusted', 'angry', 'sad', 'surprised', 'fearful', 'neutral']
fps = 24
intervals = 24
pause = 12

def get_emotion_letter(sdf1, sdf2, ratio):
    sdf = sdf1 * (1-ratio) + sdf2 * ratio
    letter = np.where(sdf < 0, 0, 255)
    return letter[:, :, None]

def generate_video(frames, output_path):
    clip = ImageSequenceClip(frames, fps=fps)
    clip.write_videofile(output_path, codec="libx264", audio=False)

for letter in letter_list:
    emotion_sdf = []
    for emotion in emotion_en:
            path = f'sdf/{letter}_{emotion}.png'
            img = cv2.imread(path)
            sdf = np.array(img).astype(float)/255.0
            sdf -= 0.5
            sdf = np.where(sdf < 0, -(pow(-sdf, 0.65)), sdf)
            emotion_sdf.append(sdf)
    frames = []
    frame = None
    for i in range(len(emotion_sdf)-1):
        current_sdf = emotion_sdf[i]
        next_sdf = emotion_sdf[i+1]
        for j in range(intervals):
            print(j / (intervals-1))
            frame = get_emotion_letter(current_sdf, next_sdf, j / (intervals-1))
            frames.append(frame)
            # frames.append(current_sdf[:, :, None])
        for j in range(pause):
            frames.append(frame)
    print(frames[0].shape)
    generate_video(frames, output_path=f'output_{letter}.mp4')    
