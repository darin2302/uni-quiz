"""Builds all quizzes and copies them into this site folder.

Usage:
    python publish.py                     # rebuild + copy kgvr/, tsp/, okk/, oks/
    python publish.py --password NEW      # same, and set a new site password

Then commit and push. Stdlib only.
"""
import argparse
import hashlib
import json
import os
import pathlib
import re
import subprocess
import sys

SITE = pathlib.Path(__file__).resolve().parent
UNI = SITE.parent


def src(*parts):
    """Папка с източниците: до сайта или едно ниво по-нагоре (ако сайтът е разархивиран в подпапка)."""
    for base in (UNI, UNI.parent):
        if base.joinpath(*parts).exists():
            return base.joinpath(*parts)
    return UNI.joinpath(*parts)


# (папка в сайта, папка с build_quiz.py)
QUIZZES = [
    ("kgvr", src("kgvr", "study")),
    ("tsp", src("st", "study")),
    ("okk", src("ОКК", "study")),
    ("oks", src("ОКС", "study")),
]

HEAD_INJECT = '<script src="../gate.js"></script>\n<meta name="robots" content="noindex, nofollow">\n'


def build(study):
    print(f"build: {study}", flush=True)
    env = dict(os.environ, PYTHONIOENCODING="utf-8")
    r = subprocess.run([sys.executable, "build_quiz.py"], cwd=study, env=env)
    if r.returncode:
        sys.exit(f"build_quiz.py failed in {study}")


def inject_head(html):
    m = re.search(r"<head[^>]*>\s*", html, flags=re.I)
    if not m:
        sys.exit("no <head> in quiz.html")
    return html[:m.end()] + HEAD_INJECT + html[m.end():]


def counts(html):
    raw = re.search(r'<script id="data" type="application/json">(.*?)</script>', html, flags=re.S).group(1)
    data = json.loads(raw.replace("<\\/", "</"))
    n = sum(len(qs) for l in data["lectures"] for qs in l["tests"].values())
    return n, len(data["lectures"])


def update_landing(stats):
    index = SITE / "index.html"
    text = index.read_text(encoding="utf8")
    for name, (n, lecs) in stats.items():
        text = re.sub(rf'(<span data-count="{name}">)\d+(</span>)', rf"\g<1>{n}\g<2>", text)
        text = re.sub(rf'(<span data-lecs="{name}">)\d+(</span>)', rf"\g<1>{lecs}\g<2>", text)
    index.write_text(text, encoding="utf8", newline="\n")


def set_password(pw):
    gate = SITE / "gate.js"
    h = hashlib.sha256(pw.encode("utf8")).hexdigest()
    text, n = re.subn(r"var HASH = '[0-9a-f]{64}';", f"var HASH = '{h}';", gate.read_text(encoding="utf8"))
    if n != 1:
        sys.exit("HASH line not found in gate.js")
    gate.write_text(text, encoding="utf8", newline="\n")
    print(f"password updated (sha256 {h[:12]}...) - everyone must re-enter it")


def main():
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--password", help="set a new shared password (stores only its SHA-256 in gate.js)")
    args = ap.parse_args()

    stats = {}
    for name, study in QUIZZES:
        if not (study / "build_quiz.py").exists():
            # източниците ги няма на тази машина - оставяме публикуваната версия
            print(f"skip: {study} not found, keeping {name}/index.html", flush=True)
            continue
        build(study)
        html = (study / "quiz.html").read_text(encoding="utf8")
        stats[name] = counts(html)
        out = SITE / name / "index.html"
        out.parent.mkdir(exist_ok=True)
        out.write_text(inject_head(html), encoding="utf8", newline="\n")
        print(f"  -> {out.relative_to(SITE)} ({stats[name][0]} questions, {stats[name][1]} topics)")
    update_landing(stats)

    if args.password:
        set_password(args.password)
    print("done - now commit and push")


if __name__ == "__main__":
    main()
