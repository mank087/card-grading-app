/* Maintained, version-guarded native changes for Expo Camera. Applied by npm
 * postinstall on EAS; never silently patch a different upstream version.
 * --check verifies an already patched installation. Tests use an isolated copy.
 */
const fs = require('node:fs');
const path = require('node:path');
const base = path.resolve(__dirname, '..');
const android = 'android/src/main/java/expo/modules/camera/';
const fragment = name => fs.readFileSync(path.join(base, 'native-camera', name), 'utf8').replace(/\r\n/g, '\n').trimEnd();
function changes() {
  return [
    [android + 'CameraViewModule.kt', '    Name("ExpoCamera")', '    Name("ExpoCamera")\n    Property("dcmCaptureControlsVersion") { 1 }'],
    [android + 'CameraViewModule.kt', '      AsyncFunction("getAvailablePictureSizes")', `      AsyncFunction("dcmFocusAtPoint") { view: ExpoCameraView, x: Float, y: Float, promise: Promise ->
        view.dcmFocusAtPoint(x, y, promise)
      }.runOnQueue(Queues.MAIN)

      AsyncFunction("dcmCancelFocus") { view: ExpoCameraView ->
        view.dcmCancelFocus()
      }.runOnQueue(Queues.MAIN)

      AsyncFunction("getAvailablePictureSizes")`],
    [android + 'ExpoCameraView.kt', '  private fun startFocusMetering() {', fragment('AndroidFocus.kt.fragment') + '\n\n  private fun startFocusMetering() {'],
    [android + 'ExpoCameraView.kt', '  fun cleanupCamera() {', '  fun cleanupCamera() {\n    dcmCancelFocus()'],
    [android + 'ExpoCameraView.kt', '    imageCaptureUseCase = ImageCapture.Builder()\n', '    imageCaptureUseCase = ImageCapture.Builder()\n      .setCaptureMode(ImageCapture.CAPTURE_MODE_MAXIMIZE_QUALITY)\n'],
    ['ios/CameraViewModule.swift', '    Name("ExpoCamera")', '    Name("ExpoCamera")\n    Property("dcmCaptureControlsVersion") { 1 }'],
    ['ios/CameraViewModule.swift', '      AsyncFunction("getAvailablePictureSizes")', `      AsyncFunction("dcmFocusAtPoint") { (view: CameraView, x: Double, y: Double, promise: Promise) in
        view.dcmFocusAtPoint(x, y, promise: promise)
      }

      AsyncFunction("dcmCancelFocus") { (view: CameraView) in
        view.dcmCancelFocus()
      }

      AsyncFunction("getAvailablePictureSizes")`],
    ['ios/Current/CameraView.swift', '  // MARK: Property Observers', fragment('IOSFocus.swift.fragment') + '\n\n  // MARK: Property Observers'],
    ['ios/Current/CameraSessionManager.swift', '    let photoOutput = AVCapturePhotoOutput()', '    let photoOutput = AVCapturePhotoOutput()\n    photoOutput.maxPhotoQualityPrioritization = .quality'],
    ['ios/Current/CameraPhotoCapture.swift', '      photoSettings.photoQualityPrioritization = .balanced', '      photoSettings.photoQualityPrioritization = .quality'],
    // Android already returns the Bitmap before encoding on its pictureRef path.
    // Preserve the equivalent oriented/cropped UIImage on iOS without a JPEG roundtrip.
    ['ios/Current/CameraPhotoCapture.swift', '    let width = takenImage.size.width', `    if options.pictureRef {
      // PictureRef reports CGImage pixel dimensions. Bake UIImage orientation
      // into pixels so those dimensions match ImageManipulator's crop space.
      let format = UIGraphicsImageRendererFormat()
      format.scale = 1
      let upright = UIGraphicsImageRenderer(size: takenImage.size, format: format).image { _ in
        takenImage.draw(in: CGRect(origin: .zero, size: takenImage.size))
      }
      return PictureRef(upright)
    }

    let width = takenImage.size.width`],
  ];
}
function patchCamera(directory = path.join(base, 'node_modules/expo-camera'), check = false) {
  const installed = JSON.parse(fs.readFileSync(path.join(directory, 'package.json'), 'utf8')).version;
  if (installed !== '17.0.10') throw new Error(`Camera patch requires expo-camera 17.0.10; found ${installed}. Review upstream before upgrading.`);
  const files = new Map();
  for (const [relative, before, after] of changes()) {
    let text = files.get(relative) ?? fs.readFileSync(path.join(directory, relative), 'utf8').replace(/\r\n/g, '\n');
    if (!text.includes(after)) {
      if (check) throw new Error(`Camera patch missing in ${relative}. Run npm install in dcm-mobile.`);
      if (text.split(before).length !== 2) throw new Error(`Camera patch anchor changed in ${relative}; refusing partial patch.`);
      text = text.replace(before, after);
    }
    files.set(relative, text);
  }
  // Validate all files before writing any of them.
  if (!check) for (const [relative, content] of files) fs.writeFileSync(path.join(directory, relative), content);
  return [...files.keys()];
}
if (require.main === module) {
  const check = process.argv.includes('--check');
  console.log(`Camera capture patch ${check ? 'verified' : 'applied'}: ${patchCamera(undefined, check).length} native files`);
}
module.exports = { patchCamera, changes };
