<?php
declare(strict_types=1);

// IAG only. The historical paid-video.php and its cookie remain independent.
const IAG_VIDEO_COURSE = 'formation-ia-generative-elearning';
const IAG_VIDEO_VERSION = 'iag-v7-2026-10-21-with-explicit-v8-media';
const IAG_VIDEO_TTL = 120;

function iagVideoFail(int $status): never
{
    http_response_code($status);
    exit;
}
header('Cache-Control: private, no-store, max-age=0');
header('Referrer-Policy: no-referrer');
header('X-Content-Type-Options: nosniff');
header('Cross-Origin-Resource-Policy: same-origin');

$method = $_SERVER['REQUEST_METHOD'] ?? '';
if (!in_array($method, ['POST', 'GET', 'HEAD'], true)) {
    header('Allow: POST, GET, HEAD');
    iagVideoFail(405);
}
$configPath = __DIR__ . '/.private/paid-video-config.php';
$manifestPath = __DIR__ . '/.private/iag-video-manifest.php';
if (!is_file($configPath) || !is_file($manifestPath)) iagVideoFail(503);
$config = require $configPath;
$secret = is_array($config) && is_string($config['signing_secret'] ?? null) ? $config['signing_secret'] : '';
if (strlen($secret) < 32) iagVideoFail(503);
$manifest = require $manifestPath;
if (!is_array($manifest)) iagVideoFail(503);

if ($method === 'POST') {
    if (($_SERVER['HTTP_ORIGIN'] ?? '') !== 'https://formaprompt.com') iagVideoFail(403);
    if ($_GET !== [] || strtolower(trim(explode(';', $_SERVER['CONTENT_TYPE'] ?? '')[0])) !== 'application/json') iagVideoFail(400);
    if ((int) ($_SERVER['CONTENT_LENGTH'] ?? 0) > 2048) iagVideoFail(413);
    $raw = file_get_contents('php://input', false, null, 0, 2049);
    if (!is_string($raw) || strlen($raw) > 2048) iagVideoFail(413);
    $grant = json_decode($raw, true);
    $keys = ['courseId', 'contentVersion', 'lessonId', 'resourceId', 'expiresAt', 'signature'];
    if (!is_array($grant) || count($grant) !== count($keys) || array_diff(array_keys($grant), $keys) !== []) iagVideoFail(400);
    $course = $grant['courseId'] ?? null;
    $version = $grant['contentVersion'] ?? null;
    $lesson = $grant['lessonId'] ?? null;
    $resource = $grant['resourceId'] ?? null;
    $expiration = $grant['expiresAt'] ?? null;
    $signature = $grant['signature'] ?? null;
} else {
    if (count($_GET) !== 2 || array_diff(array_keys($_GET), ['lesson', 'resource']) !== []) iagVideoFail(400);
    $lesson = $_GET['lesson'] ?? null;
    $resource = $_GET['resource'] ?? null;
    if (!is_string($resource) || !preg_match('/^res-[a-f0-9]{24}$/D', $resource)) iagVideoFail(403);
    $cookie = $_COOKIE['fp_iag_video_' . $resource] ?? '';
    $parts = is_string($cookie) ? explode('.', $cookie) : [];
    if (count($parts) !== 3 || !ctype_digit($parts[0]) || strlen($parts[0]) > 10) iagVideoFail(403);
    $course = IAG_VIDEO_COURSE;
    $version = IAG_VIDEO_VERSION;
    $expiration = (int) $parts[0];
    $signature = $parts[2];
    if ($lesson !== $parts[1]) iagVideoFail(403);
}
$now = time();
if ($course !== IAG_VIDEO_COURSE || $version !== IAG_VIDEO_VERSION
    || !is_string($lesson) || !preg_match('/^l[1-7][1-9]$/D', $lesson)
    || !is_string($resource) || !preg_match('/^res-[a-f0-9]{24}$/D', $resource)
    || !is_int($expiration) || $expiration <= $now || $expiration > $now + IAG_VIDEO_TTL
    || !is_string($signature) || !preg_match('/^[a-f0-9]{64}$/D', $signature)) iagVideoFail(403);
$signed = "iag-video-v1\n" . $course . "\n" . $version . "\n" . $lesson . "\n" . $resource . "\n" . $expiration;
if (!hash_equals(hash_hmac('sha256', $signed, $secret), $signature)) iagVideoFail(403);

$entry = $manifest[$resource] ?? null;
if (!is_array($entry) || ($entry['resourceId'] ?? null) !== $resource
    || ($entry['courseId'] ?? null) !== $course || ($entry['contentVersion'] ?? null) !== $version
    || !is_array($entry['lessonIds'] ?? null) || !in_array($lesson, $entry['lessonIds'], true)
    || ($entry['fileName'] ?? null) !== $resource . '.mp4'
    || !is_int($entry['bytes'] ?? null) || $entry['bytes'] < 1
    || !is_string($entry['sha256'] ?? null) || !preg_match('/^[a-f0-9]{64}$/D', $entry['sha256'])) iagVideoFail(404);
$private = realpath(__DIR__ . '/.private');
$base = realpath(__DIR__ . '/.private/iag-video-files');
$path = $base === false ? false : realpath($base . DIRECTORY_SEPARATOR . $entry['fileName']);
if ($private === false || $base === false || !str_starts_with($base, $private . DIRECTORY_SEPARATOR)
    || $path === false || $path !== $base . DIRECTORY_SEPARATOR . $entry['fileName']
    || is_link($base . DIRECTORY_SEPARATOR . $entry['fileName']) || !is_file($path)
    || filesize($path) !== $entry['bytes']) iagVideoFail(404);

if ($method === 'POST') {
    setcookie('fp_iag_video_' . $resource, $expiration . '.' . $lesson . '.' . $signature, [
        'expires' => $expiration, 'path' => '/iag-video.php', 'secure' => true,
        'httponly' => true, 'samesite' => 'Strict',
    ]);
    http_response_code(204);
    exit;
}
$size = $entry['bytes'];
$start = 0;
$end = $size - 1;
$range = $_SERVER['HTTP_RANGE'] ?? '';
if ($range !== '') {
    $valid = preg_match('/^bytes=(\d*)-(\d*)$/D', $range, $matches) === 1
        && ($matches[1] !== '' || $matches[2] !== '')
        && strlen($matches[1]) <= 18 && strlen($matches[2]) <= 18;
    if ($valid && $matches[1] === '') {
        $suffix = (int) $matches[2];
        $valid = $suffix > 0;
        $start = max(0, $size - $suffix);
    } elseif ($valid) {
        $start = (int) $matches[1];
        $end = $matches[2] === '' ? $end : min((int) $matches[2], $end);
        $valid = $start <= $end && $start < $size;
    }
    if (!$valid) {
        header('Content-Range: bytes */' . $size);
        iagVideoFail(416);
    }
    http_response_code(206);
    header("Content-Range: bytes {$start}-{$end}/{$size}");
}
$length = $end - $start + 1;
$handle = fopen($path, 'rb');
if ($handle === false || fseek($handle, $start) !== 0) iagVideoFail(500);
header('Content-Type: video/mp4');
header('Accept-Ranges: bytes');
header('Content-Length: ' . $length);
if ($method === 'HEAD') { fclose($handle); exit; }
while ($length > 0 && !feof($handle)) {
    $chunk = fread($handle, min(1024 * 1024, $length));
    if ($chunk === false || $chunk === '') { fclose($handle); exit; }
    echo $chunk;
    $length -= strlen($chunk);
    if (connection_aborted()) break;
}
fclose($handle);
