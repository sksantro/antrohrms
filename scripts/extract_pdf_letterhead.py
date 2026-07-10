import os

import fitz

pdf_path = r'c:\Users\Tanaya\Downloads\Revised offer letter Modala pavani sagar offer letter.pdf'
out_dir = r'c:\Users\Tanaya\OneDrive\Documents\sushil\hrms\antro-hrms\frontend\public\offer-letter-assets'
os.makedirs(out_dir, exist_ok=True)

doc = fitz.open(pdf_path)
page = doc[0]
pix = page.get_pixmap(matrix=fitz.Matrix(2, 2))
pix.save(os.path.join(out_dir, 'sample-page-1.png'))

for index, img in enumerate(page.get_images(full=True)):
    xref = img[0]
    base = doc.extract_image(xref)
    ext = base['ext']
    image_path = os.path.join(out_dir, f'embedded-image-{index}.{ext}')
    with open(image_path, 'wb') as file:
        file.write(base['image'])
    print(f'image {index}: {ext}, {len(base["image"])} bytes -> {image_path}')

print('page size', page.rect)
