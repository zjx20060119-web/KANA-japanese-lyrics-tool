package com.kana.furigana;

import android.content.ContentResolver;
import android.content.ContentValues;
import android.media.MediaScannerConnection;
import android.net.Uri;
import android.os.Build;
import android.os.Environment;
import android.provider.MediaStore;
import android.util.Base64;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileOutputStream;
import java.io.OutputStream;

@CapacitorPlugin(name = "ImageSaver")
public class ImageSaverPlugin extends Plugin {

    @PluginMethod
    public void saveImage(PluginCall call) {
        String base64 = call.getString("base64");
        if (base64 == null || base64.trim().isEmpty()) {
            call.reject("图片数据为空。");
            return;
        }

        String requestedName = call.getString("fileName", "KANA.png");
        String fileName = requestedName.replaceAll("[\\\\/:*?\"<>|]", "-");
        if (!fileName.toLowerCase().endsWith(".png")) {
            fileName += ".png";
        }

        try {
            byte[] bytes = Base64.decode(base64, Base64.DEFAULT);
            Uri uri;
            String location;

            if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                ContentResolver resolver = getContext().getContentResolver();
                ContentValues values = new ContentValues();
                values.put(MediaStore.Images.Media.DISPLAY_NAME, fileName);
                values.put(MediaStore.Images.Media.MIME_TYPE, "image/png");
                values.put(
                    MediaStore.Images.Media.RELATIVE_PATH,
                    Environment.DIRECTORY_PICTURES + "/KANA"
                );
                values.put(MediaStore.Images.Media.IS_PENDING, 1);

                uri = resolver.insert(
                    MediaStore.Images.Media.EXTERNAL_CONTENT_URI,
                    values
                );
                if (uri == null) {
                    throw new IllegalStateException("无法创建系统图库文件。");
                }

                try (OutputStream stream = resolver.openOutputStream(uri)) {
                    if (stream == null) {
                        throw new IllegalStateException("无法写入系统图库文件。");
                    }
                    stream.write(bytes);
                    stream.flush();
                }

                values.clear();
                values.put(MediaStore.Images.Media.IS_PENDING, 0);
                resolver.update(uri, values, null, null);
                location = "Pictures/KANA/" + fileName;
            } else {
                File externalPictures = getContext().getExternalFilesDir(
                    Environment.DIRECTORY_PICTURES
                );
                if (externalPictures == null) {
                    throw new IllegalStateException("无法访问外部图片目录。");
                }
                File pictures = new File(
                    externalPictures,
                    "KANA"
                );
                if (!pictures.exists() && !pictures.mkdirs()) {
                    throw new IllegalStateException("无法创建图片目录。");
                }

                File target = new File(pictures, fileName);
                try (FileOutputStream stream = new FileOutputStream(target)) {
                    stream.write(bytes);
                    stream.flush();
                }

                MediaScannerConnection.scanFile(
                    getContext(),
                    new String[] { target.getAbsolutePath() },
                    new String[] { "image/png" },
                    null
                );
                uri = Uri.fromFile(target);
                location = target.getAbsolutePath();
            }

            JSObject result = new JSObject();
            result.put("uri", uri.toString());
            result.put("location", location);
            result.put("fileName", fileName);
            call.resolve(result);
        } catch (Exception error) {
            call.reject(
                error.getMessage() == null ? "保存图片失败。" : error.getMessage(),
                error
            );
        }
    }
}
