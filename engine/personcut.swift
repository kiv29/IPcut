// personcut — batch person segmentation via Apple Vision.
// usage: personcut <inDir> <outDir>   (processes *.png, writes RGBA cutout PNGs)
import Foundation
import Vision
import CoreImage
import UniformTypeIdentifiers

let args = CommandLine.arguments
guard args.count == 3 else { fputs("usage: personcut <inDir> <outDir>\n", stderr); exit(1) }
let inDir = args[1], outDir = args[2]
try? FileManager.default.createDirectory(atPath: outDir, withIntermediateDirectories: true)

let files = try FileManager.default.contentsOfDirectory(atPath: inDir)
  .filter { $0.hasSuffix(".png") }.sorted()
let ctx = CIContext()

for (i, f) in files.enumerated() {
  let url = URL(fileURLWithPath: inDir + "/" + f)
  guard let src = CIImage(contentsOf: url) else { continue }
  let req = VNGeneratePersonSegmentationRequest()
  req.qualityLevel = .accurate
  req.outputPixelFormat = kCVPixelFormatType_OneComponent8
  let handler = VNImageRequestHandler(ciImage: src, options: [:])
  try handler.perform([req])
  guard let maskPB = req.results?.first?.pixelBuffer else { continue }
  var mask = CIImage(cvPixelBuffer: maskPB)
  let sx = src.extent.width / mask.extent.width
  let sy = src.extent.height / mask.extent.height
  mask = mask.transformed(by: CGAffineTransform(scaleX: sx, y: sy))
  let blend = CIFilter(name: "CIBlendWithMask", parameters: [
    kCIInputImageKey: src,
    kCIInputBackgroundImageKey: CIImage.empty().cropped(to: src.extent),
    kCIInputMaskImageKey: mask])!
  guard let out = blend.outputImage else { continue }
  let dst = URL(fileURLWithPath: outDir + "/" + f)
  try ctx.writePNGRepresentation(of: out, to: dst,
    format: .RGBA8, colorSpace: CGColorSpace(name: CGColorSpace.sRGB)!)
  if i % 100 == 0 { print("\(i)/\(files.count)") }
}
print("done \(files.count)")
