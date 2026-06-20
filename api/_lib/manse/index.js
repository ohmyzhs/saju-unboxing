// 자체 만세력 엔진 — Phase 5: 통합 어댑터.
// 5개 모듈 → 기존 SAJULAB 호환 { ok, cost:0, summary, full } 계약으로 매핑.
// 기존 buildSajuContext/Compat/Cycle/Yearly 4개 빌더가 그대로 소비할 수 있어야 한다.
import { normalizeInput, computeChart } from "./calendar.js";
import { deriveDetails } from "./derive.js";
import { calcStrengthYongsin } from "./strengthYongsin.js";
import { calcShinsal } from "./shinsal.js";
import { calcLuckCycles } from "./luckCycles.js";

export const ENGINE = { name: "self-integrated-manse", version: "1.0.0", calendarKernel: "manseryeok", rulesetVersion: "saju_engine-port-1" };

const ANIMAL = { 자: "쥐", 축: "소", 인: "호랑이", 묘: "토끼", 진: "용", 사: "뱀", 오: "말", 미: "양", 신: "원숭이", 유: "닭", 술: "개", 해: "돼지" };
const STEM_HANJA_EL = { 갑: "木", 을: "木", 병: "火", 정: "火", 무: "土", 기: "土", 경: "金", 신: "金", 임: "水", 계: "水" };
const EL_KO = { 木: "목", 火: "화", 土: "토", 金: "금", 水: "수" };
// 한글 간지 → 한자 (SAJULAB 계약은 한자. 프론트 STEM_COLOR·compactPerson 이 한자 키 사용)
const H_STEM = { 갑: "甲", 을: "乙", 병: "丙", 정: "丁", 무: "戊", 기: "己", 경: "庚", 신: "辛", 임: "壬", 계: "癸" };
const H_BR = { 자: "子", 축: "丑", 인: "寅", 묘: "卯", 진: "辰", 사: "巳", 오: "午", 미: "未", 신: "申", 유: "酉", 술: "戌", 해: "亥" };
const hs = (c) => H_STEM[c] || c || "";
const hb = (c) => H_BR[c] || c || "";
const hHidden = (h) => (h ? { yeogi: hs(h.yeogi), junggi: h.junggi ? hs(h.junggi) : null, bongi: hs(h.bongi) } : h);
const hLuck = (e) => ({ ...e, stem: hs(e.stem), branch: hb(e.branch) });
// 십이운성 → 위치강약
const STAGE_STRENGTH = { 제왕: "왕", 임관: "건록", 관대: "강", 장생: "강", 목욕: "중", 양: "중", 쇠: "중", 병: "약", 사: "약", 묘: "약", 절: "약", 태: "약" };

function pillarFull(P, tenGods, details, shin, k) {
  if (!P[k]) return null;
  const p = P[k];
  return {
    stem: hs(p.stem), branch: hb(p.branch),
    stemElement: STEM_HANJA_EL[p.stem] || "",
    hiddenStems: hHidden(details.hiddenStems[k]) || {},
    stemTenGod: tenGods[k] ? tenGods[k].stem : "",
    branchTenGod: tenGods[k] ? tenGods[k].branch : "",
    twelveStage: details.twelveStages[k] || "",
    napeum: details.napeum[k] || "",
    pillarStrength: STAGE_STRENGTH[details.twelveStages[k]] || "",
  };
}

/**
 * 외부 SAJULAB computeManse 대체 — 로컬 계산. 외부 HTTP 없음, cost 0.
 * @param {object} profile 프론트 프로필
 * @param {Date} [today] 세운/월운 기준 (기본 현재)
 * @returns {{ok:true, cost:0, summary:object, full:object, meta:object}}
 */
export function computeManseLocal(profile, today = new Date()) {
  const norm = normalizeInput(profile);
  const chart = computeChart(norm);
  const details = deriveDetails(chart);
  const sy = calcStrengthYongsin(chart, details);
  const shin = calcShinsal(chart);
  const luck = calcLuckCycles(chart, norm.y, today);

  const P = chart.pillars;
  const order = ["year", "month", "day", "hour"];

  // full.pillar
  const pillar = {};
  for (const k of order) pillar[k] = pillarFull(P, chart.tenGods, details, shin, k);

  // pillarsDetail (summary) — 위치강약·신살 포함
  const pillarsDetail = {};
  for (const k of order) {
    if (!P[k]) { pillarsDetail[k] = null; continue; }
    pillarsDetail[k] = {
      stemTenGod: chart.tenGods[k] ? chart.tenGods[k].stem : "",
      branchTenGod: chart.tenGods[k] ? chart.tenGods[k].branch : "",
      twelveStage: details.twelveStages[k] || "",
      shensha: shin.byPillar[k] ? shin.byPillar[k].shensha : "",
      bojoShinsal: shin.byPillar[k] ? shin.byPillar[k].bojoShinsal : [],
      pillarStrength: STAGE_STRENGTH[details.twelveStages[k]] || "",
    };
  }

  const yongsinKoStr = EL_KO[sy.yongsin.yongsin] || "";

  const summary = {
    dayStem: hs(P.day.stem), dayBranch: hb(P.day.branch),
    yearAnimal: ANIMAL[P.year.branch] || "",
    strength: sy.strength,
    yongsin: yongsinKoStr,
    pillars: {
      year: hs(P.year.stem) + hb(P.year.branch), month: hs(P.month.stem) + hb(P.month.branch),
      day: hs(P.day.stem) + hb(P.day.branch), hour: P.hour ? hs(P.hour.stem) + hb(P.hour.branch) : null,
    },
    elements: details.elements,
    thisYear: luck.thisYear,
    currentDaeun: luck.currentDaeun,
    pillarsDetail,
    shinsal: { gongmangDay: shin.gongmangDay, tianyiGuiren: shin.tianyiGuiren },
    daeunList: luck.daeun.map(hLuck),
  };

  const full = {
    pillar,
    yinyang: details.yinyang,
    tenGodStats: details.tenGodStats,
    strength: sy.strength,
    yongsin: {
      yongsin: sy.yongsin.yongsin, huisin: sy.yongsin.huisin, gisin: sy.yongsin.gisin, gusin: sy.yongsin.gusin, hansin: sy.yongsin.hansin,
      method: sy.yongsin.method, confidence: sy.yongsin.confidence, reasons: sy.yongsin.reasons,
    },
    hyungchung: details.hyungchung,
    shinsal: { gongmangDay: shin.gongmangDay, tianyiGuiren: shin.tianyiGuiren },
    daeun: luck.daeun.map(hLuck),
    nyunun: luck.nyunun.map(hLuck),
    wolun: luck.wolun.map(hLuck),
  };

  return {
    ok: true,
    cost: 0,
    summary,
    full,
    meta: {
      engine: ENGINE,
      policy: chart.policy,
      dataQuality: { ...chart.dataQuality, countBasis: details.countBasis },
      strengthMethod: { method: sy.yongsin.method, confidence: sy.strengthDetail.composite.confidence, reasons: sy.yongsin.reasons },
      uncertainFields: chart.dataQuality.birthTimeKnown ? [] : ["pillar.hour", "pillarsDetail.hour", "시주 십성·신살"],
    },
  };
}
