#scatter_analysis
import numpy as np
import matplotlib.pyplot as plt
from PIL import Image
from io import BytesIO
import base64
import cv2

def analyze_image_scatter(image_path: str):
    img = Image.open(image_path).convert("RGB")
    img_np = np.array(img)

    # Split into channels
    r, g, b = cv2.split(img_np)

    # Compute entropy per channel
    def entropy(channel):
        hist, _ = np.histogram(channel.flatten(), bins=256, range=(0, 256))
        hist = hist / hist.sum()
        hist = hist[hist > 0]
        return -np.sum(hist * np.log2(hist))

    entropies = {
        "R_entropy": entropy(r),
        "G_entropy": entropy(g),
        "B_entropy": entropy(b)
    }

    # Correlation between channels
    correlations = {
        "R-G_corr": np.corrcoef(r.flatten(), g.flatten())[0, 1],
        "R-B_corr": np.corrcoef(r.flatten(), b.flatten())[0, 1],
        "G-B_corr": np.corrcoef(g.flatten(), b.flatten())[0, 1]
    }

    # FFT scatter visualization
    fig, axs = plt.subplots(1, 3, figsize=(9, 3))
    for ax, channel, color in zip(axs, [r, g, b], ['R', 'G', 'B']):
        f = np.fft.fft2(channel)
        fshift = np.fft.fftshift(f)
        spectrum = 20 * np.log(np.abs(fshift) + 1)
        ax.imshow(spectrum, cmap='gray')
        ax.set_title(f"{color} channel FFT")
        ax.axis('off')

    plt.tight_layout()
    buf = BytesIO()
    plt.savefig(buf, format="png")
    plt.close(fig)
    buf.seek(0)
    scatter_img_b64 = base64.b64encode(buf.read()).decode('utf-8')

    # Overall synthetic heuristic
    mean_entropy = np.mean(list(entropies.values()))
    avg_corr = np.mean(list(correlations.values()))
    synthetic_score = round((avg_corr - mean_entropy/10 + 1) / 2, 3)

    return {
        "entropies": entropies,
        "correlations": correlations,
        "synthetic_likelihood": synthetic_score,
        "scatter_image_base64": scatter_img_b64
    }
