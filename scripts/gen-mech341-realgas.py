"""Generate src/courses/mech341/lib/realgasRef.json: argon (CoolProp) Z, Zh, Zs on a Tr/Pr grid for testing leeKesler.
Zh = (h_ideal - h)/(R Tc) at the same T; Zs = (s_ideal - s)/R at the same T, P (departure from ideal gas at same T,P)."""
import json, os
import CoolProp.CoolProp as CP
F = 'Argon'
Tc, Pc = 150.687, 4863e3
R = 8.314462618 / 0.039948  # J/kg/K
out = []
for Tr in [0.8, 0.85, 0.9, 0.95, 1.0, 1.05, 1.1, 1.2, 1.3, 1.5, 2.0, 2.5, 3.0]:
    T = Tr * Tc
    for Pr in [0.05, 0.1, 0.2, 0.5, 1.0, 2.0, 3.0, 5.0]:
        P = Pr * Pc
        if Tr < 1:
            Ps = CP.PropsSI('P', 'T', T, 'Q', 1, F)
            if P >= Ps * 0.999:
                continue  # liquid/two-phase side
        try:
            rho = CP.PropsSI('D', 'T', T, 'P', P, F)
            h = CP.PropsSI('H', 'T', T, 'P', P, F)
            s = CP.PropsSI('S', 'T', T, 'P', P, F)
        except ValueError:
            continue  # exactly at the critical point (CoolProp refuses)
        # ideal gas at same T and very low P: h_ig(T) = h(T, P->0); s_ig(T,P) = s(T,P0) - R ln(P/P0)
        P0 = 1.0
        h0 = CP.PropsSI('H', 'T', T, 'P', P0, F)
        s0 = CP.PropsSI('S', 'T', T, 'P', P0, F) - R * __import__('math').log(P / P0)
        Z = P / (rho * R * T)
        out.append({'Tr': Tr, 'Pr': Pr, 'Z': Z, 'Zh': (h0 - h) / (R * Tc), 'Zs': (s0 - s) / R})
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'src', 'courses', 'mech341', 'lib', 'realgasRef.json')
json.dump(out, open(path, 'w'), indent=0)
print(len(out), 'points')
