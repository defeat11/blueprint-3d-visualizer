/**
 * Builds a ready-to-run Python script for the Nano Banana / Gemini image
 * generator. The MASTER prompt is escaped so it can be embedded inside a
 * Python triple-quoted string without breaking the literal.
 */

function escapeForTripleQuotedString(text: string): string {
  return text
    .replace(/\\/g, "\\\\")
    .replace(/"""/g, '\\"\\"\\"');
}

export function buildNanoBananaScript(promptText: string): string {
  const safePrompt = escapeForTripleQuotedString(promptText);

  return `"""
=====================================================================
  Nano Banana - النسخة المتقدمة (Advanced Edition)
=====================================================================

  ميزات إضافية في هذه النسخة:
  - توليد دفعة كاملة من الصور بأنماط مختلفة
  - إعادة المحاولة التلقائية عند الفشل
  - حفظ البرومت بجوار كل صورة كمرجع
  - حساب التكلفة التقديرية
  - تقرير نهائي مفصّل

  الاستخدام:
      python generate_office_advanced.py

=====================================================================
"""

import os
import sys
import time
import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from google import genai
from google.genai import types
from PIL import Image
from io import BytesIO

# ==========================================================
# إعدادات عامة
# ==========================================================
API_KEY = os.environ.get("GEMINI_API_KEY")
MODEL_NAME = "gemini-2.5-flash-image-preview"
OUTPUT_DIR = Path("./output_advanced")
OUTPUT_DIR.mkdir(exist_ok=True)

# تكلفة تقديرية لكل صورة (بالدولار)
COST_PER_IMAGE_USD = 0.039

# أقصى عدد محاولات عند فشل التوليد
MAX_RETRIES = 3

# ==========================================================
# البرومت الأساسي
# ==========================================================
BASE_PROMPT = """${safePrompt}"""

# ==========================================================
# دالة التوليد مع إعادة المحاولة
# ==========================================================
def generate_with_retry(
    client: genai.Client,
    prompt: str,
    variant_id: int,
) -> Optional[Path]:
    """يحاول توليد صورة مع إعادة المحاولة عند الفشل."""
    for attempt in range(1, MAX_RETRIES + 1):
        try:
            print(f"   🔄 المحاولة {attempt}/{MAX_RETRIES}...")
            response = client.models.generate_content(
                model=MODEL_NAME,
                contents=[prompt],
                config=types.GenerateContentConfig(
                    response_modalities=["IMAGE", "TEXT"],
                ),
            )

            for part in response.candidates[0].content.parts:
                if part.inline_data is not None:
                    timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
                    base_name = f"render_v{variant_id}_{timestamp}"

                    img_path = OUTPUT_DIR / f"{base_name}.png"
                    image = Image.open(BytesIO(part.inline_data.data))
                    image.save(img_path, "PNG", quality=95)

                    txt_path = OUTPUT_DIR / f"{base_name}_prompt.txt"
                    txt_path.write_text(prompt, encoding="utf-8")

                    print(f"   ✅ نجح! الحجم: {image.size[0]}x{image.size[1]}")
                    return img_path

            print("   ⚠️  لا توجد صورة في الاستجابة")

        except Exception as e:
            print(f"   ❌ خطأ: {type(e).__name__}: {str(e)[:100]}")
            if attempt < MAX_RETRIES:
                wait_time = 2 ** attempt
                print(f"   ⏳ الانتظار {wait_time} ثانية قبل إعادة المحاولة...")
                time.sleep(wait_time)

    return None

# ==========================================================
# الدالة الرئيسية
# ==========================================================
def main(num_variants: int = 3):
    """يولّد عدة نسخ من نفس البرومت ويحفظ تقريراً مفصّلاً."""
    if not API_KEY:
        print("❌ خطأ: GEMINI_API_KEY غير موجود")
        sys.exit(1)

    print("\\n" + "═" * 65)
    print("  🎨  Nano Banana — النسخة المتقدمة  🎨")
    print("═" * 65)
    print(f"  📦 النموذج     : {MODEL_NAME}")
    print(f"  🔢 عدد النسخ   : {num_variants}")
    print(f"  💰 التكلفة     : ~\${num_variants * COST_PER_IMAGE_USD:.3f} USD")
    print(f"  📁 الإخراج     : {OUTPUT_DIR.absolute()}")
    print("═" * 65 + "\\n")

    client = genai.Client(api_key=API_KEY)
    successful: list[Path] = []
    failed: list[int] = []
    start_time = time.time()

    for i in range(1, num_variants + 1):
        print(f"━━━ النسخة {i}/{num_variants} ━━━")
        result = generate_with_retry(client, BASE_PROMPT, i)
        if result:
            successful.append(result)
        else:
            failed.append(i)
        print()

    elapsed = time.time() - start_time
    actual_cost = len(successful) * COST_PER_IMAGE_USD

    print("═" * 65)
    print("  📊  تقرير نهائي  📊")
    print("═" * 65)
    print(f"  ✅ نجحت     : {len(successful)} صورة")
    print(f"  ❌ فشلت     : {len(failed)} صورة")
    print(f"  ⏱️  المدة     : {elapsed:.1f} ثانية")
    print(f"  💵 التكلفة  : \${actual_cost:.3f} USD")
    print("═" * 65)

    report = {
        "timestamp": datetime.now().isoformat(),
        "model": MODEL_NAME,
        "requested": num_variants,
        "successful": len(successful),
        "failed": len(failed),
        "elapsed_seconds": round(elapsed, 2),
        "estimated_cost_usd": round(actual_cost, 3),
        "files": [str(p.name) for p in successful],
    }
    report_path = OUTPUT_DIR / "generation_report.json"
    report_path.write_text(
        json.dumps(report, indent=2, ensure_ascii=False),
        encoding="utf-8",
    )
    print(f"\\n  📄 التقرير محفوظ في: {report_path}")

    if successful:
        print("\\n  📂 الصور المولّدة:")
        for path in successful:
            print(f"     • {path.name}")

if __name__ == "__main__":
    main(num_variants=3)
`;
}
