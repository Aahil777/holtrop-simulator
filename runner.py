"""
Runs holtrop.simulate() and records which lines of resistance() executed,
with the values each line produced. Shared by the browser (Pyodide) and the
desktop app (native Python), so both show the same trace.
"""

import json
import sys
import time

import holtrop


def run(ship_json, knots, vmin, vmax):
    ship = json.loads(ship_json)
    events, prev, last = [], {}, [None]

    def snap(frame):
        return {k: v for k, v in frame.f_locals.items()
                if isinstance(v, (int, float)) and not isinstance(v, bool)}

    def local_tracer(frame, event, arg):
        cur = snap(frame)
        changed = {k: v for k, v in cur.items() if k not in prev or prev[k] != v}
        if last[0] is not None:
            events.append([last[0], changed])
        prev.clear()
        prev.update(cur)
        last[0] = frame.f_lineno if event == "line" else None
        return local_tracer

    def tracer(frame, event, arg):
        return local_tracer if frame.f_code is holtrop.resistance.__code__ else None

    t0 = time.perf_counter()
    previous = sys.gettrace()
    sys.settrace(tracer)
    try:
        point = holtrop.resistance(ship, knots)
    finally:
        sys.settrace(previous)
    t1 = time.perf_counter()
    curve = holtrop.sweep(ship, vmin, vmax)
    t2 = time.perf_counter()
    return json.dumps({
        "point": point, "curve": curve, "validity": holtrop.validity(ship, point["Fn"]),
        "trace": events, "t_point": (t1 - t0) * 1e3, "t_curve": (t2 - t1) * 1e3,
        "n_curve": len(curve),
    })


def version():
    return sys.version.split()[0]
