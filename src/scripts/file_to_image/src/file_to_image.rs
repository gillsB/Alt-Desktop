use std::{fs::File, path::Path};
use anyhow::Result;
use image::ImageFormat;
use file_icon_provider::get_file_icon;

fn main() -> Result<()> {
    let args: Vec<String> = std::env::args().collect();
    if args.len() != 4 {
        eprintln!("Usage: <filePath> <outputPath> <imageSize>");
        std::process::exit(1);
    }
    let file_path = &args[1];
    let output_path = &args[2];
    let size: u32 = args[3].parse()?;

    // Retrieve icon
    let icon = get_file_icon(Path::new(file_path), size as u16)
        .map_err(|e| anyhow::anyhow!("Failed to get icon: {:?}", e))?;

    // Convert raw RGBA bytes into an image
    let img = image::DynamicImage::ImageRgba8(
        image::RgbaImage::from_raw(icon.width, icon.height, icon.pixels)
            .ok_or_else(|| anyhow::anyhow!("Invalid icon buffer size"))?
    );

    // Resize and save
    let resized = img.resize_exact(size, size, image::imageops::FilterType::Lanczos3);
    let mut out = File::create(output_path)?;
    resized.write_to(&mut out, ImageFormat::Png)?;
    println!("Saved icon to {}", output_path);

    Ok(())
}
