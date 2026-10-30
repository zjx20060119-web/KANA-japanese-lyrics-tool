# Font assets

- `SourceHanSansSC-VF.woff2` is Adobe's official Source Han Sans SC variable font, converted to WOFF2 for faster loading. It is used for interface text and is covered by `LICENSE-SourceHanSans.txt`.
- `yumin.ttf` is a local Windows Yu Mincho font used for Japanese lyrics and titles. It is intentionally ignored by Git because its license does not permit redistribution.
- `CALIST.TTF` is the Windows Calisto MT font used for romaji. It is intentionally ignored by Git because its license does not permit redistribution.

Local setup for a new machine:

```powershell
Copy-Item C:\Windows\Fonts\yumin.ttf .\frontend\public\fonts\yumin.ttf
Copy-Item C:\Windows\Fonts\CALIST.TTF .\frontend\public\fonts\CALIST.TTF
```

To rebuild the WOFF2 file from Adobe's official OTF release:

```powershell
Invoke-WebRequest -Uri "https://raw.githubusercontent.com/adobe-fonts/source-han-sans/release/Variable/OTF/SourceHanSansSC-VF.otf" -OutFile "$env:TEMP\SourceHanSansSC-VF.otf"
pip install "fonttools[woff]" brotli
python -m fontTools.ttLib.woff2 compress "$env:TEMP\SourceHanSansSC-VF.otf" -o ".\frontend\public\fonts\SourceHanSansSC-VF.woff2"
```
