<?php
declare(strict_types=1);

const FORMAPROMPT_VIDEO_COURSE = 'formation-prompt-level-1';
const FORMAPROMPT_VIDEO_MAX_TTL = 300;
const FORMAPROMPT_VIDEO_FILE = 'assets/FP_-_Capsule_001_-_Rédiger_un_bon_prompt_finale_with_captions-Bpy1HKEs.mp4';

function failVideo(int $status): never
{
    http_response_code($status);
    header('Cache-Control: no-store');
    exit;
}

$configPath = __DIR__ . '/.private/paid-video-config.php';
if (!is_file($configPath)) {
    failVideo(503);
}
$config = require $configPath;
$secret = is_array($config) && isset($config['signing_secret']) && is_string($config['signing_secret'])
    ? $config['signing_secret']
    : '';
if (strlen($secret) < 32) {
    failVideo(503);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $origin = $_SERVER['HTTP_ORIGIN'] ?? '';
    if ($origin !== 'https://formaprompt.com') {
        failVideo(403);
    }
    $payload = json_decode((string) file_get_contents('php://input'), true);
    $course = is_array($payload) && isset($payload['course']) && is_string($payload['course']) ? $payload['course'] : '';
    $expiration = is_array($payload) && isset($payload['exp']) && is_int($payload['exp']) ? $payload['exp'] : 0;
    $signature = is_array($payload) && isset($payload['sig']) && is_string($payload['sig']) ? strtolower($payload['sig']) : '';
} elseif ($_SERVER['REQUEST_METHOD'] === 'GET') {
    $cookie = isset($_COOKIE['formaprompt_paid_video']) && is_string($_COOKIE['formaprompt_paid_video'])
        ? $_COOKIE['formaprompt_paid_video']
        : '';
    $parts = explode('.', $cookie, 2);
    $course = FORMAPROMPT_VIDEO_COURSE;
    $expiration = count($parts) === 2 && ctype_digit($parts[0]) ? (int) $parts[0] : 0;
    $signature = count($parts) === 2 ? strtolower($parts[1]) : '';
} else {
    failVideo(405);
}
$now = time();
if (
    $course !== FORMAPROMPT_VIDEO_COURSE
    || $expiration < $now
    || $expiration > $now + FORMAPROMPT_VIDEO_MAX_TTL + 30
    || !preg_match('/^[a-f0-9]{64}$/', $signature)
) {
    failVideo(403);
}

$expected = hash_hmac('sha256', $course . "\n" . $expiration, $secret);
if (!hash_equals($expected, $signature)) {
    failVideo(403);
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    setcookie('formaprompt_paid_video', $expiration . '.' . $signature, [
        'expires' => $expiration,
        'path' => '/paid-video.php',
        'secure' => true,
        'httponly' => true,
        'samesite' => 'Strict',
    ]);
    header('Cache-Control: no-store');
    http_response_code(204);
    exit;
}

$videoPath = realpath(__DIR__ . '/' . FORMAPROMPT_VIDEO_FILE);
$assetsPath = realpath(__DIR__ . '/assets');
if ($videoPath === false || $assetsPath === false || !str_starts_with($videoPath, $assetsPath . DIRECTORY_SEPARATOR)) {
    failVideo(404);
}

$size = filesize($videoPath);
if ($size === false || $size < 1) {
    failVideo(404);
}

$start = 0;
$end = $size - 1;
$range = $_SERVER['HTTP_RANGE'] ?? '';
if ($range !== '') {
    if (!preg_match('/^bytes=(\d*)-(\d*)$/', $range, $matches)) {
        header('Content-Range: bytes */' . $size);
        failVideo(416);
    }
    if ($matches[1] === '' && $matches[2] !== '') {
        $suffix = min((int) $matches[2], $size);
        $start = $size - $suffix;
    } else {
        $start = $matches[1] === '' ? 0 : (int) $matches[1];
        $end = $matches[2] === '' ? $end : min((int) $matches[2], $end);
    }
    if ($start < 0 || $start > $end || $start >= $size) {
        header('Content-Range: bytes */' . $size);
        failVideo(416);
    }
    http_response_code(206);
    header("Content-Range: bytes {$start}-{$end}/{$size}");
}

$length = $end - $start + 1;
header('Content-Type: video/mp4');
header('Accept-Ranges: bytes');
header('Content-Length: ' . $length);
header('Cache-Control: private, no-store, max-age=0');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');

$handle = fopen($videoPath, 'rb');
if ($handle === false || fseek($handle, $start) !== 0) {
    failVideo(500);
}
while ($length > 0 && !feof($handle)) {
    $chunk = fread($handle, min(1024 * 1024, $length));
    if ($chunk === false) {
        fclose($handle);
        failVideo(500);
    }
    echo $chunk;
    $length -= strlen($chunk);
    if (connection_aborted()) {
        break;
    }
}
fclose($handle);
