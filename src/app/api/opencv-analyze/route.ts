import { NextRequest, NextResponse } from 'next/server';
import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

/**
 * OpenCV Card Analysis API Endpoint
 *
 * This endpoint calls the Python OpenCV service to perform pixel-level card analysis.
 * It provides objective measurements that the LLM cannot generate on its own:
 * - Precise centering measurements (pixel-perfect)
 * - Edge whitening detection (color ΔE analysis)
 * - Corner rounding and whitening measurements
 * - Surface defect detection (scratches, white dots, creases)
 * - Glare masking and sleeve detection
 *
 * Method: Uses child_process to spawn Python script directly (more reliable than HTTP)
 */

interface OpenCVAnalysisRequest {
  frontUrl: string;
  backUrl?: string;
}

interface OpenCVMetrics {
  version: string;
  run_id: string;
  front: any;
  back: any;
}

export async function POST(request: NextRequest) {
  console.log('[OpenCV Analyze] Starting analysis...');

  try {
    const body: OpenCVAnalysisRequest = await request.json();

    if (!body.frontUrl) {
      return NextResponse.json(
        { error: 'frontUrl is required' },
        { status: 400 }
      );
    }

    console.log('[OpenCV Analyze] Front URL:', body.frontUrl);
    if (body.backUrl) {
      console.log('[OpenCV Analyze] Back URL:', body.backUrl);
    }

    // Download images to temp directory
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencv-'));
    const frontPath = path.join(tempDir, 'front.jpg');
    const backPath = body.backUrl ? path.join(tempDir, 'back.jpg') : null;

    console.log('[OpenCV Analyze] Downloading images...');

    // Download front image
    const frontResponse = await fetch(body.frontUrl);
    if (!frontResponse.ok) {
      throw new Error(`Failed to download front image: ${frontResponse.statusText}`);
    }
    const frontBuffer = await frontResponse.arrayBuffer();
    fs.writeFileSync(frontPath, Buffer.from(frontBuffer));

    // Download back image if provided
    if (body.backUrl && backPath) {
      const backResponse = await fetch(body.backUrl);
      if (!backResponse.ok) {
        throw new Error(`Failed to download back image: ${backResponse.statusText}`);
      }
      const backBuffer = await backResponse.arrayBuffer();
      fs.writeFileSync(backPath, Buffer.from(backBuffer));
    }

    console.log('[OpenCV Analyze] Images downloaded, running Python analysis...');

    // Create output directory
    const outputDir = path.join(tempDir, 'output');
    fs.mkdirSync(outputDir, { recursive: true });

    // Prepare Python command
    const pythonPath = 'C:\\Users\\benja\\AppData\\Local\\Programs\\Python\\Python313\\python.exe';
    const scriptPath = path.join(process.cwd(), 'opencv_service', 'card_cv_stage1.py');

    const args = [
      scriptPath,
      '--front', frontPath,
      '--outdir', outputDir
    ];

    if (backPath) {
      args.push('--back', backPath);
    }

    console.log('[OpenCV Analyze] Running:', pythonPath, args.join(' '));

    // Run Python script
    const metrics = await runPythonScript(pythonPath, args, outputDir);

    console.log('[OpenCV Analyze] Analysis complete!');
    console.log('[OpenCV Analyze] Metrics:', JSON.stringify(metrics, null, 2));

    // Clean up temp files
    try {
      fs.rmSync(tempDir, { recursive: true, force: true });
    } catch (cleanupError) {
      console.warn('[OpenCV Analyze] Cleanup warning:', cleanupError);
    }

    return NextResponse.json(metrics, { status: 200 });

  } catch (error: any) {
    console.error('[OpenCV Analyze] Error:', error);
    return NextResponse.json(
      {
        error: 'OpenCV analysis failed',
        message: error.message,
        details: error.stack
      },
      { status: 500 }
    );
  }
}

/**
 * Run Python script and return parsed metrics
 */
function runPythonScript(
  pythonPath: string,
  args: string[],
  outputDir: string
): Promise<OpenCVMetrics> {
  return new Promise((resolve, reject) => {
    const process = spawn(pythonPath, args);

    let stdout = '';
    let stderr = '';

    process.stdout.on('data', (data) => {
      stdout += data.toString();
      console.log('[Python stdout]', data.toString());
    });

    process.stderr.on('data', (data) => {
      stderr += data.toString();
      console.error('[Python stderr]', data.toString());
    });

    process.on('close', (code) => {
      console.log(`[Python] Process exited with code ${code}`);

      if (code !== 0) {
        reject(new Error(`Python script failed with code ${code}: ${stderr}`));
        return;
      }

      // Read the generated metrics JSON
      const metricsPath = path.join(outputDir, 'stage1_metrics.json');

      if (!fs.existsSync(metricsPath)) {
        reject(new Error('Metrics file not found after Python execution'));
        return;
      }

      try {
        const metricsJson = fs.readFileSync(metricsPath, 'utf-8');
        const metrics = JSON.parse(metricsJson);
        resolve(metrics);
      } catch (parseError: any) {
        reject(new Error(`Failed to parse metrics JSON: ${parseError.message}`));
      }
    });

    process.on('error', (error) => {
      reject(new Error(`Failed to spawn Python process: ${error.message}`));
    });
  });
}

/**
 * GET endpoint for health check
 */
export async function GET(request: NextRequest) {
  return NextResponse.json({
    status: 'healthy',
    service: 'opencv-analyze',
    version: '1.0.0',
    pythonPath: 'C:\\Users\\benja\\AppData\\Local\\Programs\\Python\\Python313\\python.exe',
    scriptPath: path.join(process.cwd(), 'opencv_service', 'card_cv_stage1.py')
  });
}
