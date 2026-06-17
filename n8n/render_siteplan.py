#!/usr/bin/env python3
"""
render_siteplan.py — render a location's SharePoint Site Plan tab(s) to PNG(s).

Used by the n8n "Floorplan Image Render" workflow (weekly). Given the location's
.xlsx (downloaded from SharePoint via Graph), it renders the Site Plan tab — and
a separate Office plan tab if one exists — to faithful, full-color PNGs by:
  1. isolating the target tab (hide every other sheet so only it prints),
  2. forcing fit-to-one-page (landscape),
  3. converting with LibreOffice headless -> PDF -> PNG (pdftoppm),
  4. trimming surrounding whitespace (ImageMagick `convert -trim`).

Requires on the host:  libreoffice (soffice), poppler-utils (pdftoppm), imagemagick (convert).
    sudo apt-get install -y libreoffice-calc poppler-utils imagemagick

Usage:
    python3 render_siteplan.py <input.xlsx> <propId> <out_dir>
Prints one JSON line:  {"warehouse": "/out/<propId>-warehouse.png", "office": "/out/<propId>-office.png"|null}
(office is null when the location draws its offices on the same tab as the warehouse.)
"""
import sys, os, re, json, shutil, zipfile, subprocess, tempfile

# Per-location overrides (keyed by propId; tolerant match). Only the few that differ.
PROFILES = {
    'banana-fontana':    {'tab': 'WH Site Plan'},
    'terminal-west-sac': {'tab': 'Site Plan', 'officeTab': 'OFFICE SITEPLAN'},
}

def pick_profile(prop_id):
    if prop_id in PROFILES:
        return PROFILES[prop_id]
    norm = lambda s: re.sub(r'[^a-z0-9]+', '', str(s).lower())
    np = norm(prop_id)
    for k, v in PROFILES.items():
        nk = norm(k)
        if len(nk) >= 6 and (np in nk or nk in np):
            return v
    return {}

def list_sheets(xlsx):
    """Return ordered sheet names from the workbook (no external deps)."""
    with zipfile.ZipFile(xlsx) as z:
        wb = z.read('xl/workbook.xml').decode('utf-8', 'replace')
    return [m.group(1) for m in re.finditer(r'<sheet[^>]*name="([^"]+)"', wb)]

def pick_tab(names, want, office=False):
    if want:
        for n in names:
            if n.lower() == str(want).lower():
                return n
    if office:
        for n in names:
            if re.search(r'office', n, re.I) and re.search(r'(site|plan|layout|floor)', n, re.I):
                return n
        return ''
    for pat in (r'site\s*plan', r'warehouse|layout|floor\s*plan'):
        for n in names:
            if re.search(pat, n, re.I) and not re.search(r'office|off\s*site', n, re.I):
                return n
    for n in names:
        if re.search(r'site\s*plan|floor', n, re.I):
            return n
    return names[0] if names else ''

def isolate_and_fit(src_xlsx, target, work_xlsx):
    """Unzip, hide every sheet but `target`, force fit-to-one-page, rezip -> work_xlsx."""
    d = tempfile.mkdtemp()
    try:
        with zipfile.ZipFile(src_xlsx) as z:
            z.extractall(d)
        wbp = os.path.join(d, 'xl', 'workbook.xml')
        wb = open(wbp, encoding='utf-8').read()
        rels = open(os.path.join(d, 'xl', '_rels', 'workbook.xml.rels'), encoding='utf-8').read()
        rid2t = {m.group(1): m.group(2) for m in re.finditer(r'Id="([^"]+)"[^>]*Target="([^"]+)"', rels)}
        order = [(m.group(1), m.group(2)) for m in re.finditer(r'<sheet[^>]*name="([^"]+)"[^>]*r:id="([^"]+)"', wb)]
        names = [n for n, _ in order]
        if target not in names:
            target = names[0]
        tidx = names.index(target)

        def fix(m):
            tag = m.group(0)
            nm = re.search(r'name="([^"]+)"', tag).group(1)
            tag = re.sub(r'\s+state="[^"]*"', '', tag)          # strip any existing state
            if nm == target:
                return tag
            return tag[:-2] + ' state="hidden"/>' if tag.endswith('/>') else tag.replace('>', ' state="hidden">', 1)
        wb = re.sub(r'<sheet [^>]*?/>', fix, wb)
        if 'activeTab=' in wb:
            wb = re.sub(r'activeTab="\d+"', f'activeTab="{tidx}"', wb)
        else:
            wb = re.sub(r'(<workbookView)', rf'\1 activeTab="{tidx}"', wb, count=1)
        open(wbp, 'w', encoding='utf-8').write(wb)

        # fit-to-page on the target sheet
        tgt = rid2t[[r for n, r in order if n == target][0]]
        path = os.path.join(d, 'xl', tgt.lstrip('/')) if not tgt.startswith('xl/') else os.path.join(d, tgt)
        if not os.path.exists(path):
            path = os.path.join(d, 'xl', 'worksheets', os.path.basename(tgt))
        s = open(path, encoding='utf-8').read()
        if '<sheetPr' not in s:
            s = re.sub(r'(<worksheet[^>]*>)', r'\1<sheetPr><pageSetUpPr fitToPage="1"/></sheetPr>', s, 1)
        elif 'pageSetUpPr' not in s:
            s = re.sub(r'<sheetPr([^>]*)>', r'<sheetPr\1><pageSetUpPr fitToPage="1"/>', s, 1)
        if '<pageSetup' in s:
            s = re.sub(r'<pageSetup[^>]*/>', '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1"/>', s, 1)
        else:
            s = s.replace('</worksheet>',
                          '<pageMargins left="0.2" right="0.2" top="0.2" bottom="0.2" header="0" footer="0"/>'
                          '<pageSetup orientation="landscape" fitToWidth="1" fitToHeight="1"/></worksheet>')
        open(path, 'w', encoding='utf-8').write(s)

        # repack
        if os.path.exists(work_xlsx):
            os.remove(work_xlsx)
        with zipfile.ZipFile(work_xlsx, 'w', zipfile.ZIP_DEFLATED) as z:
            for root, _, files in os.walk(d):
                for f in files:
                    full = os.path.join(root, f)
                    z.write(full, os.path.relpath(full, d))
    finally:
        shutil.rmtree(d, ignore_errors=True)

def render_tab(src_xlsx, target, out_png, dpi=150):
    tmp = tempfile.mkdtemp()
    try:
        work = os.path.join(tmp, 'work.xlsx')
        isolate_and_fit(src_xlsx, target, work)
        subprocess.run(['libreoffice', '--headless', '--calc', '--convert-to', 'pdf',
                        '--outdir', tmp, work], check=True,
                       stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=180)
        pdf = os.path.join(tmp, 'work.pdf')
        if not os.path.exists(pdf):
            return False
        subprocess.run(['pdftoppm', '-png', '-r', str(dpi), '-singlefile', pdf, os.path.join(tmp, 'page')],
                       check=True, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=120)
        raw = os.path.join(tmp, 'page.png')
        if not os.path.exists(raw):
            return False
        # trim surrounding whitespace; fall back to the untrimmed page if convert is absent
        try:
            subprocess.run(['convert', raw, '-trim', '+repage', out_png], check=True,
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL, timeout=60)
        except Exception:
            shutil.copy(raw, out_png)
        return os.path.exists(out_png)
    finally:
        shutil.rmtree(tmp, ignore_errors=True)

def main():
    if len(sys.argv) < 4:
        print(json.dumps({'error': 'usage: render_siteplan.py <input.xlsx> <propId> <out_dir>'}))
        sys.exit(2)
    src, prop_id, out_dir = sys.argv[1], sys.argv[2], sys.argv[3]
    os.makedirs(out_dir, exist_ok=True)
    prof = pick_profile(prop_id)
    names = list_sheets(src)
    wh_tab = pick_tab(names, prof.get('tab'), office=False)
    of_tab = pick_tab(names, prof.get('officeTab'), office=True)
    result = {'warehouse': None, 'office': None, 'wh_tab': wh_tab, 'office_tab': of_tab or None}
    if wh_tab:
        p = os.path.join(out_dir, f'{prop_id}-warehouse.png')
        if render_tab(src, wh_tab, p):
            result['warehouse'] = p
    if of_tab and of_tab != wh_tab:
        p = os.path.join(out_dir, f'{prop_id}-office.png')
        if render_tab(src, of_tab, p):
            result['office'] = p
    print(json.dumps(result))

if __name__ == '__main__':
    main()
