import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import domtoimage from "dom-to-image-more";
import Cropper from "react-easy-crop";
import { getCroppedImg } from "./cropUtils";
import { getPalette } from "./colorUtils";

function waitForImagesToLoad(container: HTMLElement): Promise<void> {
  const imgs = Array.from(container.querySelectorAll("img"));
  return Promise.all(
    imgs.map(
      (img) =>
        new Promise<void>((resolve) => {
          if (img.complete && img.naturalHeight !== 0) resolve();
          else {
            img.onload = () => resolve();
            img.onerror = () => resolve(); // resolve anyway to prevent hanging
          }
        })
    )
  ).then(() => undefined);
}
const getSuggestedColors = async (imageUrl: string): Promise<string[]> => {
  try {
    const palette = await Vibrant.from(imageUrl).getPalette();
    const colors: string[] = [];

    Object.values(palette).forEach((swatch) => {
      if (swatch) {
        const [r, g, b] = swatch.rgb;
        if (!isColorTooDarkOrLight(r, g, b)) {
          const hex = rgbToHex(r, g, b);
          if (!colors.some((c) => areColorsSimilar(c, hex))) {
            colors.push(hex);
          }
        }
      }
    });

    return colors.slice(0, 5);
  } catch (error) {
    console.error("Error generating suggested colors:", error);
    return [];
  }
};

const isColorTooDarkOrLight = (r: number, g: number, b: number): boolean => {
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness < 40 || brightness > 220;
};

const rgbToHex = (r: number, g: number, b: number): string =>
  "#" +
  [r, g, b]
    .map((x) => {
      const hex = x.toString(16);
      return hex.length === 1 ? "0" + hex : hex;
    })
    .join("");

const areColorsSimilar = (hex1: string, hex2: string): boolean => {
  const rgb1 = hexToRgb(hex1);
  const rgb2 = hexToRgb(hex2);
  if (!rgb1 || !rgb2) return false;

  const distance = Math.sqrt(
    Math.pow(rgb1.r - rgb2.r, 2) +
      Math.pow(rgb1.g - rgb2.g, 2) +
      Math.pow(rgb1.b - rgb2.b, 2)
  );

  return distance < 60;
};

const hexToRgb = (hex: string): { r: number; g: number; b: number } | null => {
  const res = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return res
    ? {
        r: parseInt(res[1], 16),
        g: parseInt(res[2], 16),
        b: parseInt(res[3], 16),
      }
    : null;
};

export default function App() {
  const [formData, setFormData] = useState({
    modelName: "",
    subtitle: "",
    colours: "",
    ageGroup: "",
    packageInfo: "",
    wholesalePrice: "",
    resellerPrice: "",
  });

  const fieldLabels: { [key: string]: string } = {
    modelName: "Model Name",
    subtitle: "Subtitle",
    colours: "Colours",
    ageGroup: "Age Group",
    packageInfo: "Package Info",
    wholesalePrice: "Wholesale Price",
    resellerPrice: "Reseller Price",
  };

  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [dominantColor, setDominantColor] = useState("#d1b3c4");
  const [overrideColor, setOverrideColor] = useState("");
  const [suggestedColors, setSuggestedColors] = useState<string[]>([]);
  const [fontColor, setFontColor] = useState("white");
  const [imageBgOverride, setImageBgOverride] = useState("white");
  const [wholesaleUnit, setWholesaleUnit] = useState("/ piece");
  const [resellerUnit, setResellerUnit] = useState("/ piece");
  const [packageUnit, setPackageUnit] = useState("pcs / set");
  const [ageGroupUnit, setAgeGroupUnit] = useState("months");

  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<any>(null);
  const [cropping, setCropping] = useState(false);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImagePreview(reader.result as string);
        setCropping(true);
      };
      reader.readAsDataURL(file);
    }
  };

  useEffect(() => {
    if (!imagePreview) return;
    const img = new Image();
    img.src = imagePreview;
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      canvas.width = 100;
      canvas.height = (img.height / img.width) * 100;
      ctx?.drawImage(img, 0, 0, canvas.width, canvas.height);

      const imageData = ctx?.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData?.data;
      if (!data) return;

      let r = 0,
        g = 0,
        b = 0,
        count = 0,
        bgWhite = 0,
        bgBlack = 0;

      for (let i = 0; i < data.length; i += 40) {
        const red = data[i],
          green = data[i + 1],
          blue = data[i + 2],
          alpha = data[i + 3];
        if (alpha > 100) {
          if (red > 240 && green > 240 && blue > 240) bgWhite++;
          else if (red < 15 && green < 15 && blue < 15) bgBlack++;
          else {
            r += red;
            g += green;
            b += blue;
            count++;
          }
        }
      }

      if (count > 0) {
        const dominant = `rgb(${Math.floor(r / count)}, ${Math.floor(
          g / count
        )}, ${Math.floor(b / count)})`;
        setDominantColor(dominant);
      }

      setImageBgOverride(bgWhite > bgBlack ? "white" : "black");

      // Suggested palette
      const palette = getPalette(img, 12);
      setSuggestedColors(palette);
    };
  }, [imagePreview]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    if (name === "fontColor") setFontColor(value);
    else if (name === "imageBgOverride") setImageBgOverride(value);
    else setFormData({ ...formData, [name]: value });
  };

  const getRGB = (color: string) => {
    if (color.startsWith("#")) {
      const bigint = parseInt(color.slice(1), 16);
      return [(bigint >> 16) & 255, (bigint >> 8) & 255, bigint & 255];
    }
    const nums = color.match(/\d+/g);
    return nums ? nums.map(Number) : [0, 0, 0];
  };

  const [r, g, b] = getRGB(overrideColor || dominantColor);
  const priceBarColor = `rgb(${r}, ${g}, ${b})`;
  const detailBackground = `rgb(${Math.min(r + 40, 255)}, ${Math.min(
    g + 40,
    255
  )}, ${Math.min(b + 40, 255)})`;

  const onCropComplete = useCallback((_: any, croppedAreaPixels: any) => {
    setCroppedAreaPixels(croppedAreaPixels);
  }, []);

  const applyCrop = async () => {
    if (!imagePreview || !croppedAreaPixels) return;
    try {
      const croppedImage = await getCroppedImg(imagePreview, croppedAreaPixels);
      setImagePreview(croppedImage);
      setCropping(false);
      setZoom(1);
      setCrop({ x: 0, y: 0 });
    } catch (error) {
      console.error("Crop failed:", error);
    }
  };

  const handleDownload = async (type: "wholesaler" | "reseller") => {
    const container = document.getElementById("catalogue-card");
    if (!container) return;

    const clone = container.cloneNode(true) as HTMLElement;
    const toRemove =
      type === "wholesaler" ? "#reseller-bar" : "#wholesaler-bar";
    clone.querySelector(toRemove)?.remove();

    clone.style.position = "fixed";
    clone.style.top = "-9999px";
    clone.style.left = "-9999px";
    clone.style.background = "white";
    clone.style.marginTop = "0";
    clone.style.paddingTop = "0";
    document.body.appendChild(clone);

    try {
      await waitForImagesToLoad(clone); // ← wait here for images to load

      const scale = 3;
      const rect = clone.getBoundingClientRect();
      const dataUrl = await domtoimage.toPng(clone, {
        width: rect.width * scale,
        height: rect.height * scale,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${rect.width}px`,
          height: `${rect.height}px`,
        },
      });

      const link = document.createElement("a");
      link.href = dataUrl;
      link.download = `${formData.modelName || "catalogue"}-${type}.png`;
      link.click();
    } catch (error) {
      console.error("Download error:", error);
    } finally {
      document.body.removeChild(clone);
    }
  };

  return (
    <div
      style={{
        padding: 20,
        maxWidth: 400,
        margin: "0 auto",
        fontFamily: "'Canva Sans', sans-serif",
      }}
    >
      <h1 style={{ textAlign: "center" }}>VG Catalogue Maker</h1>

      <div style={{ marginBottom: 16, textAlign: "center" }}>
        <label
          htmlFor="file-upload"
          style={{
            padding: "10px 20px",
            backgroundColor: "#222",
            color: "#fff",
            borderRadius: "8px",
            cursor: "pointer",
            fontFamily: "'Canva Sans', sans-serif",
            fontSize: "14px",
            boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
          }}
        >
          📁 Upload Image
        </label>
        <input
          id="file-upload"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          style={{ display: "none" }}
        />
      </div>

      {cropping && imagePreview && (
        <div
          style={{
            position: "relative",
            height: 320,
            background: "#333",
            borderRadius: 8,
          }}
        >
          <div style={{ position: "relative", width: "100%", height: 250 }}>
            <Cropper
              image={imagePreview}
              crop={crop}
              zoom={zoom}
              aspect={1}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>
          <div style={{ marginTop: 10, textAlign: "center" }}>
            <button
              onClick={applyCrop}
              style={{
                padding: "10px 25px",
                backgroundColor: "#222",
                color: "#fff",
                borderRadius: 8,
                marginRight: 12,
                fontFamily: "'Canva Sans', sans-serif",
              }}
            >
              Apply Crop
            </button>
            <button
              onClick={() => setCropping(false)}
              style={{
                padding: "10px 25px",
                backgroundColor: "#ccc",
                color: "#000",
                borderRadius: 8,
                fontFamily: "'Canva Sans', sans-serif",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {!cropping &&
        Object.keys(fieldLabels).map((name) => {
          if (
            name === "wholesalePrice" ||
            name === "resellerPrice" ||
            name === "packageInfo" ||
            name === "ageGroup"
          ) {
            return (
              <div
                key={name}
                style={{ display: "flex", gap: 10, marginBottom: 10 }}
              >
                <input
                  name={name}
                  placeholder={fieldLabels[name]}
                  value={(formData as any)[name]}
                  onChange={handleChange}
                  style={{
                    flex: 2,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    fontFamily: "'Canva Sans', sans-serif",
                  }}
                />
                <select
                  value={
                    name === "wholesalePrice"
                      ? wholesaleUnit
                      : name === "resellerPrice"
                      ? resellerUnit
                      : name === "packageInfo"
                      ? packageUnit
                      : ageGroupUnit
                  }
                  onChange={(e) =>
                    name === "wholesalePrice"
                      ? setWholesaleUnit(e.target.value)
                      : name === "resellerPrice"
                      ? setResellerUnit(e.target.value)
                      : name === "packageInfo"
                      ? setPackageUnit(e.target.value)
                      : setAgeGroupUnit(e.target.value)
                  }
                  style={{
                    flex: 1,
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    fontFamily: "'Canva Sans', sans-serif",
                  }}
                >
                  {name === "packageInfo" && (
                    <>
                      <option value="pcs / set">pcs / set</option>
                      <option value="pcs / dozen">pcs / dozen</option>
                      <option value="pcs / pack">pcs / pack</option>
                    </>
                  )}
                  {name === "ageGroup" && (
                    <>
                      <option value="Newborn">Newborn</option>
                      <option value="months">months</option>
                      <option value="years">years</option>
                    </>
                  )}
                  {(name === "wholesalePrice" || name === "resellerPrice") && (
                    <>
                      <option value="/ piece">/ piece</option>
                      <option value="/ dozen">/ dozen</option>
                    </>
                  )}
                </select>
              </div>
            );
          } else if (name === "colours") {
            return (
              <div key={name} style={{ marginBottom: 10 }}>
                <input
                  list="colours-list"
                  name={name}
                  placeholder={fieldLabels[name]}
                  value={(formData as any)[name]}
                  onChange={handleChange}
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    borderRadius: 8,
                    border: "1px solid #ccc",
                    fontSize: 14,
                    fontFamily: "'Canva Sans', sans-serif",
                  }}
                />
                <datalist id="colours-list">
                  <option value="5 Colours" />
                  <option value="6 Colours" />
                  <option value="Multicolours" />
                  <option value="Multiprints" />
                </datalist>
              </div>
            );
          } else {
            return (
              <input
                key={name}
                name={name}
                placeholder={fieldLabels[name]}
                value={(formData as any)[name]}
                onChange={handleChange}
                style={{
                  width: "100%",
                  padding: "10px 12px",
                  marginBottom: 10,
                  borderRadius: 8,
                  border: "1px solid #ccc",
                  fontSize: 14,
                  fontFamily: "'Canva Sans', sans-serif",
                }}
              />
            );
          }
        })}

      {!cropping && (
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: "12px",
            marginTop: 10,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <label
              style={{ fontFamily: "'Canva Sans', sans-serif", fontSize: 15 }}
            >
              Override BG:
            </label>
            <input
              type="color"
              value={overrideColor}
              onChange={(e) => setOverrideColor(e.target.value)}
              style={{
                width: 36,
                height: 36,
                borderRadius: 4,
                cursor: "pointer",
              }}
            />
          </div>

          <div>
            <label
              style={{
                marginBottom: 6,
                display: "block",
                fontFamily: "'Canva Sans', sans-serif",
                fontSize: 15,
              }}
            >
              Suggested Backgrounds:
            </label>
            <div style={{ display: "flex", gap: "10px", flexWrap: "wrap" }}>
              {suggestedColors.map((color) => (
                <div
                  key={color}
                  onClick={() => setOverrideColor(color)}
                  style={{
                    width: 36,
                    height: 36,
                    backgroundColor: color,
                    border:
                      overrideColor === color
                        ? "3px solid black"
                        : "1px solid #ccc",
                    cursor: "pointer",
                    borderRadius: "6px",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "40px" }}>
            {/* Font Section */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label
                style={{
                  fontFamily: "'Canva Sans', sans-serif",
                  fontSize: 15,
                  minWidth: 40,
                }}
              >
                Font :
              </label>
              {["white", "black"].map((color) => (
                <div
                  key={color}
                  onClick={() => setFontColor(color)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 80,
                    backgroundColor: color,
                    border:
                      fontColor === color ? "3px solid #000" : "1px solid #ccc",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                  title={color}
                />
              ))}
            </div>

            {/* Image BG Section */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <label
                style={{
                  fontFamily: "'Canva Sans', sans-serif",
                  fontSize: 15,
                  minWidth: 70,
                }}
              >
                Image BG:
              </label>
              {["white", "black"].map((color) => (
                <div
                  key={color}
                  onClick={() => setImageBgOverride(color)}
                  style={{
                    width: 30,
                    height: 30,
                    borderRadius: 80,
                    backgroundColor: color,
                    border:
                      imageBgOverride === color
                        ? "3px solid #000"
                        : "1px solid #ccc",
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(0,0,0,0.15)",
                  }}
                  title={color}
                />
              ))}
            </div>
          </div>
        </div>
      )}

      <div
        id="catalogue-card"
        style={{
          marginTop: 25,
          background: "white",
          fontFamily: "'Canva Sans', sans-serif",
        }}
      >
        <h2
          id="wholesaler-bar"
          style={{
            backgroundColor: priceBarColor,
            color: fontColor,
            padding: 5,
            textAlign: "center",
            fontWeight: "normal",
            fontSize: 19,
            margin: 0,
          }}
        >
          Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;₹{formData.wholesalePrice}{" "}
          {wholesaleUnit}
        </h2>

        {imagePreview && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            style={{
              backgroundColor: imageBgOverride,
              textAlign: "center",
              padding: 10,
            }}
          >
            <img
              src={imagePreview}
              alt="Preview"
              style={{ maxWidth: "100%", maxHeight: 300, objectFit: "contain" }}
            />
          </motion.div>
        )}

        <div
          style={{
            backgroundColor: detailBackground,
            color: fontColor,
            padding: 10,
            fontSize: 17,
          }}
        >
          <div style={{ textAlign: "center", marginBottom: 6 }}>
            <p
              style={{
                fontWeight: "normal",
                textShadow: "3px 3px 5px rgba(0,0,0,0.2)",
                fontSize: 30,
                margin: 3,
              }}
            >
              {formData.modelName}
            </p>
            <p style={{ fontStyle: "italic", fontSize: 22, margin: 5 }}>
              {formData.subtitle && `(${formData.subtitle})`}
            </p>
          </div>
          <div style={{ textAlign: "left", lineHeight: 1.4 }}>
            <p style={{ margin: "2px 0" }}>
              &nbsp; Colour
              &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;&nbsp;:
              &nbsp;&nbsp;
              {formData.colours}
            </p>
            <p style={{ margin: "2px 0" }}>
              &nbsp; Package &nbsp;&nbsp;&nbsp;&nbsp;&nbsp;: &nbsp;&nbsp;
              {formData.packageInfo} {packageUnit}
            </p>
            <p style={{ margin: "2px 0" }}>
              &nbsp; Age Group &nbsp;&nbsp;: &nbsp;&nbsp;
              {formData.ageGroup} {ageGroupUnit}
            </p>
          </div>
        </div>

        <h2
          id="reseller-bar"
          style={{
            backgroundColor: priceBarColor,
            color: fontColor,
            padding: 5,
            textAlign: "center",
            fontWeight: "normal",
            fontSize: 19,
            margin: 0,
          }}
        >
          Price&nbsp;&nbsp;&nbsp;:&nbsp;&nbsp;&nbsp;₹{formData.resellerPrice}{" "}
          {resellerUnit}
        </h2>
      </div>

      {!cropping && (
        <div style={{ textAlign: "center", marginTop: 10 }}>
          <button
            onClick={() => handleDownload("wholesaler")}
            style={{
              backgroundColor: "#222",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              marginRight: 10,
              fontSize: 14,
              fontFamily: "'Canva Sans', sans-serif",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          >
            Download Wholesaler
          </button>
          <button
            onClick={() => handleDownload("reseller")}
            style={{
              backgroundColor: "#222",
              color: "#fff",
              padding: "10px 18px",
              borderRadius: 8,
              border: "none",
              marginTop: 10,
              fontSize: 14,
              fontFamily: "'Canva Sans', sans-serif",
              boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
              cursor: "pointer",
            }}
          >
            Download Reseller
          </button>
        </div>
      )}
    </div>
  );
}
