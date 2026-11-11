# PyInstaller recipe for the desktop app.  Build with:  pyinstaller --noconfirm HoltropMennen.spec
# On Windows this produces dist/HoltropMennenSimulator.exe, a single file with Python inside.

web_files = ["index.html", "app.js", "style.css", "runner.html", "holtrop.py", "runner.py"]

a = Analysis(
    ["desktop_app.py"],
    datas=[(name, ".") for name in web_files] + [("vendor", "vendor")],
    excludes=["numpy", "pandas", "matplotlib", "PIL"],
)
pyz = PYZ(a.pure)
exe = EXE(
    pyz,
    a.scripts,
    a.binaries,
    a.datas,
    name="HoltropMennenSimulator",
    icon="icon.ico",
    console=False,
    upx=False,
)
