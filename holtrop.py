"""
Holtrop-Mennen (1982) resistance estimate for displacement ships.

    RT = RF(1+k1) + RAPP + RW + RB + RTR + RA

All inputs in SI units except speed (knots) and lcb (% of L, + forward).
The same file runs in the browser (Pyodide) and from the command line:

    python3 holtrop.py          # prints the worked example, 15-29 knots
"""

from math import sqrt, exp, cos, log10, pi

KNOT = 0.5144
G = 9.81


def default_ship():
    """Worked example from the course notes (205 m container ship)."""
    return {
        "L": 205.0,        # waterline length, m
        "B": 32.0,         # moulded breadth, m
        "TF": 10.0,        # draught forward, m
        "TA": 10.0,        # draught aft, m
        "volume": 37500.0, # displaced volume, m^3
        "lcb": -0.75,      # centre of buoyancy, % of L forward of L/2
        "CM": 0.98,        # midship coefficient
        "CWP": 0.75,       # waterplane coefficient
        "ABT": 20.0,       # transverse bulb area at FP, m^2
        "hB": 4.0,         # bulb centre above keel, m
        "AT": 16.0,        # immersed transom area, m^2
        "SAPP": 50.0,      # appendage wetted area, m^2
        "k2": 1.5,         # appendage form factor (1+k2)eq
        "Cstern": 10.0,    # stern shape parameter
        "iE": None,        # half angle of entrance, deg (None = estimate)
        "S": None,         # wetted surface, m^2 (None = estimate)
        "rho": 1025.0,     # water density, kg/m^3
        "nu": 1.1883e-6,   # kinematic viscosity, m^2/s
        "ks": None,        # hull roughness, m (None = standard 150 um)
        "d_thruster": 0.0, # bow-thruster tunnel diameter, m
        "CBTO": 0.003,     # tunnel opening coefficient
    }


def check_domain(CP, lcb, LR, TF, hB, ABT, knots):
    """Stop early where the regression formulas would fail or turn complex."""
    if knots <= 0:
        raise ValueError("speed must be above zero")
    if not 0.4 < CP < 0.95:
        raise ValueError(f"CP = {CP:.3f} is outside 0.40-0.95; check volume, L, B, T and CM")
    if 1 - CP + 0.0225 * lcb <= 0 or 1 - CP - 0.0225 * lcb <= 0 or LR <= 0:
        raise ValueError(f"lcb = {lcb:+.2f} % is too far from midship for CP = {CP:.3f}")
    if ABT > 0 and TF - 1.5 * hB <= 0:
        raise ValueError(f"bulb centre hB = {hB:.2f} m is too high for TF = {TF:.2f} m (need hB < TF/1.5)")


def resistance(ship, knots):
    """Run the eight steps at one speed and return every intermediate value."""
    s = dict(default_ship(), **ship)
    L, B, TF, TA = s["L"], s["B"], s["TF"], s["TA"]
    vol, lcb, CM, CWP = s["volume"], s["lcb"], s["CM"], s["CWP"]
    ABT, hB, AT = s["ABT"], s["hB"], s["AT"]
    rho, nu = s["rho"], s["nu"]

    # Step 1 - hull form
    V = knots * KNOT
    T = (TF + TA) / 2
    CB = vol / (L * B * T)
    CP = CB / CM
    Fn = V / sqrt(G * L)
    LR = L * (1 - CP + 0.06 * CP * lcb / (4 * CP - 1))
    check_domain(CP, lcb, LR, TF, hB, ABT, knots)

    # Step 2 - friction (ITTC-1957)
    S_est = L * (2 * T + B) * sqrt(CM) * (0.453 + 0.4425 * CB - 0.2862 * CM
            - 0.003467 * B / T + 0.3696 * CWP) + 2.38 * ABT / CB
    S = s["S"] if s["S"] else S_est
    Rn = V * L / nu
    CF = 0.075 / (log10(Rn) - 2) ** 2
    q = 0.5 * rho * V ** 2
    RF = q * S * CF

    # Step 3 - form factor 1+k1
    TL = T / L
    if TL > 0.05:
        c12 = TL ** 0.2228446
    elif TL > 0.02:
        c12 = 48.20 * (TL - 0.02) ** 2.078 + 0.479948
    else:
        c12 = 0.479948
    c13 = 1 + 0.003 * s["Cstern"]
    k1 = c13 * (0.93 + c12 * (B / LR) ** 0.92497 * (0.95 - CP) ** -0.521448
               * (1 - CP + 0.0225 * lcb) ** 0.6906)
    RF_k1 = RF * k1

    # Step 4 - appendages (+ optional bow-thruster tunnel)
    RAPP = q * s["SAPP"] * s["k2"] * CF
    RBT = rho * V ** 2 * pi * s["d_thruster"] ** 2 * s["CBTO"]
    RAPP = RAPP + RBT

    # Step 5 - wave making and breaking
    BL = B / L
    if BL < 0.11:
        c7 = 0.229577 * BL ** 0.33333
    elif BL < 0.25:
        c7 = BL
    else:
        c7 = 0.5 - 0.0625 * L / B
    iE_est = 1 + 89 * exp(-(L / B) ** 0.80856 * (1 - CWP) ** 0.30484
             * (1 - CP - 0.0225 * lcb) ** 0.6367 * (LR / B) ** 0.34574
             * (100 * vol / L ** 3) ** 0.16302)
    iE = s["iE"] if s["iE"] else iE_est
    c1 = 2223105 * c7 ** 3.78613 * (T / B) ** 1.07961 * (90 - iE) ** -1.37565
    c3 = 0.56 * ABT ** 1.5 / (B * T * (0.31 * sqrt(ABT) + TF - hB)) if ABT > 0 else 0.0
    c2 = exp(-1.89 * sqrt(c3))
    c5 = 1 - 0.8 * AT / (B * T * CM)
    if CP < 0.80:
        c16 = 8.07981 * CP - 13.8673 * CP ** 2 + 6.984388 * CP ** 3
    else:
        c16 = 1.73014 - 0.7067 * CP
    m1 = 0.0140407 * L / T - 1.75254 * vol ** (1 / 3) / L - 4.79323 * B / L - c16
    slender = L ** 3 / vol
    if slender < 512:
        c15 = -1.69385
    elif slender < 1727:
        c15 = -1.69385 + (L / vol ** (1 / 3) - 8.0) / 2.36
    else:
        c15 = 0.0
    m2 = c15 * CP ** 2 * exp(-0.1 * Fn ** -2)
    lam = 1.446 * CP - 0.03 * L / B if L / B < 12 else 1.446 * CP - 0.36
    d = -0.9
    W = vol * rho * G
    RW = c1 * c2 * c5 * W * exp(m1 * Fn ** d + m2 * cos(lam * Fn ** -2))

    # Step 6 - bulbous bow and immersed transom
    if ABT > 0:
        PB = 0.56 * sqrt(ABT) / (TF - 1.5 * hB)
        immersion = G * (TF - hB - 0.25 * sqrt(ABT)) + 0.15 * V ** 2
        if immersion <= 0:
            raise ValueError(f"bulb of {ABT:.0f} m^2 at hB = {hB:.1f} m breaks the surface at {knots:.1f} kn")
        Fni = V / sqrt(immersion)
        RB = 0.11 * exp(-3 * PB ** -2) * Fni ** 3 * ABT ** 1.5 * rho * G / (1 + Fni ** 2)
    else:
        PB, Fni, RB = 0.0, 0.0, 0.0
    if AT > 0:
        FnT = V / sqrt(2 * G * AT / (B + B * CWP))
        c6 = 0.2 * (1 - 0.2 * FnT) if FnT < 5 else 0.0
    else:
        FnT, c6 = 0.0, 0.0
    RTR = q * AT * c6

    # Step 7 - model-ship correlation
    c4 = TF / L if TF / L <= 0.04 else 0.04
    CA = (0.006 * (L + 100) ** -0.16 - 0.00205
          + 0.003 * sqrt(L / 7.5) * CB ** 4 * c2 * (0.04 - c4))
    if s["ks"]:
        CA = CA + (0.105 * s["ks"] ** (1 / 3) - 0.005579) / L ** (1 / 3)
    RA = q * S * CA

    # Step 8 - total resistance and effective power
    RT = RF_k1 + RAPP + RW + RB + RTR + RA
    PE = RT * V

    return {
        "knots": knots, "V": V, "T": T, "CB": CB, "CP": CP, "Fn": Fn, "LR": LR,
        "S": S, "S_est": S_est, "Rn": Rn, "CF": CF, "q": q, "RF": RF,
        "c12": c12, "c13": c13, "k1": k1, "RF_k1": RF_k1, "RAPP": RAPP, "RBT": RBT,
        "c7": c7, "iE": iE, "iE_est": iE_est, "c1": c1, "c2": c2, "c3": c3,
        "c5": c5, "c15": c15, "c16": c16, "m1": m1, "m2": m2, "lam": lam,
        "W": W, "RW": RW, "PB": PB, "Fni": Fni, "RB": RB, "FnT": FnT, "c6": c6,
        "RTR": RTR, "c4": c4, "CA": CA, "RA": RA, "RT": RT, "PE": PE,
        "CT": RT / (q * S), "CW": RW / (q * S),
    }


# Ranges commonly quoted from Holtrop and Mennen (max Fn, CP, L/B, B/T)
VALIDITY = [
    ("Tankers, bulk carriers",    0.24, (0.73, 0.85), (5.1, 7.1), (2.4, 3.2)),
    ("Trawlers, coasters, tugs",  0.38, (0.55, 0.65), (3.9, 6.3), (2.1, 3.0)),
    ("Container ships, destroyers", 0.45, (0.55, 0.67), (6.0, 9.5), (3.0, 4.0)),
    ("Cargo liners",              0.30, (0.56, 0.75), (5.3, 8.0), (2.4, 4.0)),
    ("Ro-ro ships, car ferries",  0.35, (0.55, 0.67), (5.3, 8.0), (3.2, 4.0)),
]


def validity(ship, Fn):
    s = dict(default_ship(), **ship)
    T = (s["TF"] + s["TA"]) / 2
    CP = s["volume"] / (s["L"] * s["B"] * T) / s["CM"]
    LB, BT = s["L"] / s["B"], s["B"] / T
    rows = []
    for name, fn_max, cp, lb, bt in VALIDITY:
        checks = {
            "Fn": Fn <= fn_max,
            "CP": cp[0] <= CP <= cp[1],
            "L/B": lb[0] <= LB <= lb[1],
            "B/T": bt[0] <= BT <= bt[1],
        }
        rows.append({"type": name, "fn_max": fn_max, "cp": cp, "lb": lb, "bt": bt,
                     "checks": checks, "ok": all(checks.values())})
    return {"CP": CP, "LB": LB, "BT": BT, "Fn": Fn, "rows": rows}


def sweep(ship, v_min, v_max, n=57):
    step = (v_max - v_min) / (n - 1)
    return [resistance(ship, v_min + i * step) for i in range(n)]


def simulate(ship, knots, v_min, v_max):
    """Everything the web page needs in one call."""
    point = resistance(ship, knots)
    return {"point": point, "curve": sweep(ship, v_min, v_max),
            "validity": validity(ship, point["Fn"])}


if __name__ == "__main__":
    ship = default_ship()
    r = resistance(ship, 25)
    print("Holtrop-Mennen worked example at 25 knots")
    for key, label in [("RF_k1", "Friction with form, RF(1+k1)"), ("RAPP", "Appendages, RAPP"),
                       ("RW", "Waves, RW"), ("RB", "Bulbous bow, RB"),
                       ("RTR", "Transom, RTR"), ("RA", "Correlation, RA"), ("RT", "Total, RT")]:
        print(f"  {label:<30}{r[key] / 1000:9.1f} kN  {100 * r[key] / r['RT']:5.1f} %")
    print(f"  PE = {r['PE'] / 1000:,.0f} kW\n")
    print("  kn     Fn     RT kN     PE kW")
    for kn in range(15, 30, 2):
        p = resistance(ship, kn)
        print(f"  {kn:>2}  {p['Fn']:.3f}  {p['RT'] / 1000:8.0f}  {p['PE'] / 1000:8.0f}")
