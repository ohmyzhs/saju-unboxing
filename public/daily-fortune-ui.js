(function initDailyFortuneUI(root) {
  const stems = [
    ["갑", "甲"], ["을", "乙"], ["병", "丙"], ["정", "丁"], ["무", "戊"],
    ["기", "己"], ["경", "庚"], ["신", "辛"], ["임", "壬"], ["계", "癸"],
  ];
  const branches = [
    ["자", "子"], ["축", "丑"], ["인", "寅"], ["묘", "卯"], ["진", "辰"], ["사", "巳"],
    ["오", "午"], ["미", "未"], ["신", "申"], ["유", "酉"], ["술", "戌"], ["해", "亥"],
  ];

  function findPair(value, pairs) {
    const text = String(value || "").trim();
    return pairs.find(([ko, hanja]) => text.includes(ko) || text.includes(hanja)) || null;
  }

  function normalizePillar(pillar) {
    if (!pillar) return {
      stemKo: "",
      stemHanja: "",
      branchKo: "",
      branchHanja: "",
      unknown: true,
    };

    let stemValue;
    let branchValue;
    if (typeof pillar === "string") {
      const compact = [...pillar.replace(/\s+/g, "")];
      stemValue = compact[0];
      branchValue = compact[1];
    } else {
      stemValue = pillar.stem ?? pillar.heavenlyStem ?? pillar.천간;
      branchValue = pillar.branch ?? pillar.earthlyBranch ?? pillar.지지;
    }
    const stem = findPair(stemValue, stems);
    const branch = findPair(branchValue, branches);
    if (!stem || !branch) return {
      stemKo: "",
      stemHanja: "",
      branchKo: "",
      branchHanja: "",
      unknown: true,
    };
    return {
      stemKo: stem[0],
      stemHanja: stem[1],
      branchKo: branch[0],
      branchHanja: branch[1],
      unknown: false,
    };
  }

  root.DailyFortuneUI = { normalizePillar };
})(typeof window !== "undefined" ? window : globalThis);
