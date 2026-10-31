package com.kana.furigana;

import android.content.Intent;
import android.content.pm.PackageInfo;
import android.content.pm.PackageManager;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

@CapacitorPlugin(name = "AppUpdater")
public class AppUpdaterPlugin extends Plugin {
    private static final long MAX_APK_BYTES = 200L * 1024L * 1024L;

    @PluginMethod
    public void getInfo(PluginCall call) {
        try {
            PackageManager manager = getContext().getPackageManager();
            PackageInfo info = manager.getPackageInfo(
                getContext().getPackageName(),
                0
            );
            long versionCode = Build.VERSION.SDK_INT >= Build.VERSION_CODES.P
                ? info.getLongVersionCode()
                : info.versionCode;

            JSObject result = new JSObject();
            result.put("versionName", info.versionName);
            result.put("versionCode", versionCode);
            call.resolve(result);
        } catch (Exception error) {
            call.reject("无法读取当前应用版本。", error);
        }
    }

    @PluginMethod
    public void downloadAndInstall(PluginCall call) {
        String urlValue = call.getString("url");
        if (urlValue == null || urlValue.trim().isEmpty()) {
            call.reject("更新地址为空。");
            return;
        }

        Uri updateUri;
        try {
            updateUri = Uri.parse(urlValue.trim());
        } catch (Exception error) {
            call.reject("更新地址格式不正确。", error);
            return;
        }
        String host = updateUri.getHost();
        if (
            !"https".equalsIgnoreCase(updateUri.getScheme()) ||
            host == null ||
            (!host.equals("github.com") && !host.endsWith(".githubusercontent.com"))
        ) {
            call.reject("更新包必须来自 GitHub 的安全下载地址。");
            return;
        }

        if (!canInstallPackages()) {
            openInstallPermissionSettings();
            JSObject result = new JSObject();
            result.put("started", false);
            result.put("requiresPermission", true);
            call.resolve(result);
            return;
        }

        String requestedName = call.getString("fileName", "KANA.apk");
        String fileName = requestedName.replaceAll("[\\\\/:*?\"<>|]", "-");
        if (!fileName.toLowerCase().endsWith(".apk")) {
            fileName += ".apk";
        }
        String safeFileName = fileName;

        new Thread(() -> {
            try {
                File updateDirectory = new File(
                    getContext().getCacheDir(),
                    "updates"
                );
                if (
                    !updateDirectory.exists() &&
                    !updateDirectory.mkdirs()
                ) {
                    throw new IllegalStateException("无法创建更新目录。");
                }

                File target = new File(updateDirectory, safeFileName);
                File temporary = new File(updateDirectory, safeFileName + ".part");
                downloadApk(new URL(updateUri.toString()), temporary);
                if (target.exists() && !target.delete()) {
                    throw new IllegalStateException("无法替换旧的更新包。");
                }
                if (!temporary.renameTo(target)) {
                    throw new IllegalStateException("无法保存更新包。");
                }

                getBridge().executeOnMainThread(() -> {
                    try {
                        openInstaller(target, call);
                    } catch (Exception error) {
                        call.reject(
                            error.getMessage() == null
                                ? "无法打开系统安装程序。"
                                : error.getMessage(),
                            error
                        );
                    }
                });
            } catch (Exception error) {
                getBridge().executeOnMainThread(() ->
                    call.reject(
                        error.getMessage() == null
                            ? "下载更新失败。"
                            : error.getMessage(),
                        error
                    )
                );
            }
        }).start();
    }

    private void downloadApk(URL url, File target) throws Exception {
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        connection.setConnectTimeout(20000);
        connection.setReadTimeout(30000);
        connection.setInstanceFollowRedirects(true);
        connection.setRequestProperty(
            "User-Agent",
            "KANA-Android-Updater/1.0"
        );
        connection.setRequestProperty("Accept", "application/octet-stream");

        try {
            int status = connection.getResponseCode();
            if (status < 200 || status >= 300) {
                throw new IllegalStateException(
                    "GitHub 下载失败（HTTP " + status + "）。"
                );
            }
            long contentLength = connection.getContentLengthLong();
            if (contentLength > MAX_APK_BYTES) {
                throw new IllegalStateException("更新包超过 200 MB。");
            }

            try (
                InputStream input = connection.getInputStream();
                FileOutputStream output = new FileOutputStream(target)
            ) {
                byte[] buffer = new byte[64 * 1024];
                long total = 0;
                int read;
                while ((read = input.read(buffer)) != -1) {
                    total += read;
                    if (total > MAX_APK_BYTES) {
                        throw new IllegalStateException("更新包超过 200 MB。");
                    }
                    output.write(buffer, 0, read);
                }
                output.flush();
            }
        } finally {
            connection.disconnect();
        }
    }

    private void openInstaller(File apk, PluginCall call) {
        Uri apkUri = FileProvider.getUriForFile(
            getContext(),
            getContext().getPackageName() + ".fileprovider",
            apk
        );
        Intent intent = new Intent(Intent.ACTION_VIEW);
        intent.setDataAndType(
            apkUri,
            "application/vnd.android.package-archive"
        );
        intent.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION);
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);

        JSObject result = new JSObject();
        result.put("started", true);
        result.put("requiresPermission", false);
        result.put("location", apk.getAbsolutePath());
        call.resolve(result);
    }

    private boolean canInstallPackages() {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return true;
        }
        return getContext()
            .getPackageManager()
            .canRequestPackageInstalls();
    }

    private void openInstallPermissionSettings() {
        Intent intent = new Intent(
            Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES,
            Uri.parse("package:" + getContext().getPackageName())
        );
        intent.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
        getContext().startActivity(intent);
    }
}
