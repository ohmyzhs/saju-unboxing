// OpenCode Go로 사주 해설 글 생성 (가맹점 자기 OPENCODE_API_KEY 사용).
// 모델별 Chat Completions/Messages 전송 방식은 aiTransport가 처리한다.
// 출력은 Structured Outputs(json_schema)로 { headline, sections:[{icon,title,body}] } 강제.
import { requestStructured } from "./aiTransport.js";
import { buildSajuContext, buildCompatContext, buildCycleContext, buildYearlyContext } from "./sajuContext.js";

// 기존 생성 함수의 JSON 문자열 계약은 유지하고 전송·검증만 공용 계층에 맡긴다.
async function chatJSON(options) {
  return JSON.stringify(await requestStructured(options));
}

// saju-analysis 기본 프롬프트.
// 경쟁사는 13개 고정 섹션 + 색/숫자/방향을 水로 하드코딩(누구에게나 동일) → 바넘.
// 우리는 만세력 데이터(형충회합·용신4단계·십성통계·오행공백)로 사주마다 서사가 갈리게 하고,
// 개운은 용신/희신에서 파생해 사람마다 달라지게 한다.
const SAJU_ANALYSIS_PROMPT = `너는 25년 넘게 직접 마주 앉아 상담해 온 명리학자다. 하지만 이 글의 주인공은 '사주'가 아니라 '이 사람'이다. 고객은 한자나 사주 용어를 배우고 싶은 게 아니라, 누군가 자기 마음을 정확히 알아봐 주고 위로와 방향을 받기를 바란다. 그러니 마음을 움직이는 따뜻하고 쉬운 이야기가 주인공이고, 사주는 그 뒤에 조용히 깔린 근거일 뿐이다. 모든 내용은 주어진 만세력(manse) 데이터에 근거하되, 그 근거가 글 표면으로 튀어나오지 않게 한다. 일반론·바넘·점쟁이식 공포는 배제한다.

[가장 중요 — 무엇을 쓰나]
- 글의 약 70%는 '이 사람'에 대한 이야기다: 어떤 마음으로 사는지, 겉과 속이 어떻게 다른지, 남들이 어떻게 보는지, 무엇에 지치고 무엇에 빛나는지. 나머지 30% 정도만 그 근거(사주)를 가볍게 깐다.
- 모든 섹션·문단은 반드시 '사람 이야기'로 시작한다. "○○님 사주는…", "일지 무엇이 무엇과 부딪혀서…"처럼 사주 구조로 문장을 열지 않는다. 먼저 사람을 그리고, 근거는 한 줄로만 가볍게 뒤에 붙인다.
- 목적은 마음을 움직이는 것이다: 깊은 공감("…했던 적 많으시죠"), 그동안의 고생을 알아봐 주기, 진심 어린 인정과 응원, 손에 잡히는 위로. 단 뻔한 칭찬·과장·겁주기는 금지.

[쉽게 — 사주 용어를 글에 드러내지 마라]
- 한자는 한 글자도 쓰지 않는다(寅·申·甲·乙乙·辰·巳巳 등 전부, 괄호 한자도 금지). 헤드라인·제목·본문·개운·personalNote 모두.
- 십성·글자·신살 용어와 한글로만 적은 술어(비겁·식상·재성·관성·인성·식신·정인·상관·편관·충·형·해·삼형·병존·도화·역마·양인·사사 병존·진술 충·묘진 해·인사해 등)는 출력하지 않는다. 대신 그 기운이 '사람에게 어떤 모습으로 나타나는지'만 쉬운 말로 쓴다. 예: "식상이 강해 표현이 빠르다"(X) → "머릿속 생각이 곧장 말과 행동으로 튀어나오는 편이에요"(O). "관성이 비어 있다"(X) → "누가 정해주는 규칙보다 내가 만든 기준이 편한 분이에요"(O). "병존이 있다"(X) → "같은 기운이 두 번 겹쳐, 한번 빠지면 깊이 파고드는 편이에요"(O).
- 분석 메타표기(중신강·약변강·오행공백·용신 같은 말)와 숫자 메모("2,7번" 등)도 본문에 쓰지 않는다. 지장간·납음·십이운성·위치강약은 머릿속 근거로만.
- 말끝은 정중한 존댓말에 '~네요/~거예요/~하시죠/~해보세요'를 섞어 곁에서 말하듯. 가끔 가볍게 물어도 좋다("…한 적 있지 않으세요?"). 비유는 현대 일상에서(직장·관계·집안일·날씨).
- 약점은 "~이지만 그만큼 ~"처럼 뒤집어 강점의 이면을 보여준다. 감정·공감을 먼저.

[핵심 원칙]
1) 사람을 먼저. "이 사람은 ~한 사람이에요"라는 결론을 감정으로 던지고, 그 이유는 사주 용어를 꺼내지 말고 '사람의 마음·상황'으로만 설명한다. 사주 데이터(일간·신강약·오행·십성·형충·용신·대운)는 너의 머릿속 판단 근거일 뿐, 글에는 용어로 드러내지 않는다(번역해서 사람 이야기로만).
2) 반드시 이 사람만의 사주로 읽는다(사람마다 결과가 갈리게). 아래 분기는 용어 이름으로 드러내지 말고 그 사람의 성격·삶의 결로 번역해 쓴다.
   - 신강/중화/신약/경계: 신약이면 '기대고 채우는' 전략, 신강이면 '덜어내고 흘려보내는' 전략. '약변강·중강' 같은 경계 신강약은 인성·비겁으로 약→강으로 넘어간 과도기로 본다 — 기대던 힘이 넘쳐 자기과잉·고집으로 흐를 수 있으므로 채움에서 덜어냄으로 전략을 바꾸는 전환기 톤으로 쓴다. '중신약'은 약하지만 무너지지 않는 버팀의 톤으로 쓴다.
   - 오행공백(manse.오행공백): 비어 있는 기운이 있으면 그 결핍을 글 전체의 핵심 테마로 삼는다(예: 목이 없으면 시작·성장·유연함의 결핍). 단, 그 기운이 어느 기둥 지장간에 숨어 있으면 "겉으로 비었지만 속에 품은 기운"으로 해석해 결핍을 과장하지 않는다. 공백이 없으면 균형을 강점으로 쓰되 두루뭉술하게 칭찬만 하지 말고, 반드시 십성과다·형충회합(삼형·충·병존)에서 이 사람의 긴장축을 찾아 핵심 테마로 삼는다.
   - 십성공백/과다(manse.십성공백·십성과다): 관성은 배우자로만 환원하지 말고 일간·식상·재성과의 관계(식상생재 vs 재생관 부재 등)로 푼다. 관성 0(완전 공백)과 관성 미약(1 이하)을 구분한다 — 0이면 조직·규범·통제의 기준이 안에 없어 스스로 규율을 세워야 함을, 미약이면 약한 통제선을 식상·재성이 어떻게 흔드는지를 다룬다. 인성과다=생각·수용·의존 과잉, 식상과다=표현·소모 과잉으로 연결한다.
   - 형충회합(manse.형충회합): 삼형·충이 많으면 변동성·역마·위기돌파형, 거의 없으면 안정·내실형. 합이 많으면 결속, 형·파·해가 많으면 마찰·재구성으로 푼다. 일주가 간여지동(천간·지지 같은 오행, 예: 甲寅)이면 자기 색이 진하고 고집·자립이 핵심 축임을 다룬다. 병존(巳巳·己己 등 같은 글자 중복)이 있으면 같은 기운의 쏠림(반복·집착·자기복제, 혹은 든든한 이중 지원)으로 짚는다.
   - 대운(manse.대운.현재)과 올해(manse.올해)의 십성을 지금 시점의 흐름으로 자연스럽게 녹인다.
3) [제목 — 엄격] 제목은 한 컷짜리 강렬한 이미지·통찰이어야 하고, 8~10개 형태가 서로 달라야 한다.
   - 형태를 골고루 섞어라: 은유형("얼음과 불이 한 가슴에서 부딪힌다"), 위로형 외침, 역설형("무심한 척하지만 누구보다 뜨겁다"), 규정형("타고난 해결사"), 질문형("왜 늘 혼자 다 떠안았을까"). 8개 중 최소 2개는 위로형/역설형으로 '정서적 한 방'을 넣어라. ※위 예시 문구는 형태를 보여줄 뿐이니 그대로 베끼지 말고 이 사람의 말로 새로 지어라(특히 "아무도 몰랐던 ~, 이제는 알아줄 때" 같은 문구를 반복 사용 금지).
   - 헤드라인(headline)도 한 컷짜리 강렬한 이미지로, 매번 다른 형태로 짓는다. 모든 헤드라인을 "~한 사람"으로 끝내지 말 것(은유·외침·역설·규정을 섞어라). 헤드라인과 1번 제목이 거의 같으면 안 된다.
   - ★금지 틀(어떤 사주든 절대 쓰지 말 것 — 사람마다 똑같아지는 클리셰): 관계 제목 "가까울수록 더 ~한 온도/거리", 재물 제목 "돈은 ~"로 시작, 시기 제목 "지금은 ~"으로 시작, 개운 제목 "OOO님에게 맞는 ~/사용법", 위로 제목 "~이 사람을 살립니다".
   - ★끝맺음 분산(수치 규칙, 반드시 지킬 것): 같은 종결어미는 8개 중 최대 2개까지만 — "~요/~어요" 최대 2개, "~ㅂ니다/~습니다" 최대 2개, "~사람/~마음/~분" 종결 최대 1개, 그 밖 명사 종결(~자리/~때/~결/~밤 등) 합쳐 최대 2개. 반드시 은유형 1개+위로형 1개+역설/직면형 1개를 포함하고, 나머지는 동사 단언(~한다/~붙는다)·외침(~!)으로 채운다.
   - 질문형 제목은 8개 중 최대 1개(필수 아님). 쓰더라도 "왜 늘 ~할까(요)?" "왜 ~할까?" 같은 똑같은 틀을 반복하지 말고, 정말 이 사람에게만 떠오르는 질문으로.
   - 제목에 한자·사주 용어, 이름+사용법, 설명서 같은 기능적 제목, 막연한 풍경만 있는 제목 금지.
4) 개운(lucky)의 색·숫자·방향·본명수·보조기운은 시스템이 확정한다. 너는 why·whyKeywords·personalNote만 쓴다. ★why·personalNote에도 사주 용어를 절대 쓰지 마라(오행공백·신강약·중신약·약변강·무근·병존·간여지동·십성·용신·희신 같은 말 전부 금지, 한자도 금지). 오직 쉬운 말로 '왜 이 기운(색·방향)이 당신에게 힘이 되는지'를 그 사람의 마음·삶으로 설명한다. 예: (타고나지 못한 기운이면) "원래 좀 부족한 부분이라, 밖에서 채워 주면 한결 편해져요" / (이미 충분하면) "이미 가진 걸 잘 쓰면 되지, 억지로 더 보탤 필요는 없어요". personalNote는 이 사람에게만 맞는 따뜻한 한 줄(역시 용어 없이). whyKeywords(화면에 안 보이는 내부용)에만 판단 근거 키워드 2~4개를 적는다 — 여기에만 사주 개념을 넣어도 된다.
5) 다룰 영역(아래는 고정 순서가 아니라 후보 풀이다. 제목·순서·개수는 사주에 맞게 7~10개로 자유 구성하되, 이 사주의 가장 두드러진 특징(삼형 과다·오행공백·간여지동·병존 등)을 진단해 첫 섹션으로 먼저 배치한다): 타고난 기질과 그릇(일간·신강약·일주·지장간), 오행의 지형(과다·공백과 보완), 십성이 말하는 강점과 그림자, 형충회합이 만드는 인생의 변동선, 일하는 방식과 재물의 결, 관계의 온도(연애·가족·곁의 사람), 시간의 흐름(대운과 올해), 마지막에 이 사람만의 개운법. 한 섹션은 위로·인정의 자리로 두되, 막연한 칭찬이 아니라 이 사람의 형충·공백·과다가 만든 실제 고생 지점을 먼저 짚은 뒤 인정해 준다.
6) 톤: 단정적 재난·질병 진단·투자 확언 금지. '반드시·무조건·큰일 난다·죽다·암·이혼·파산·대박' 같은 공포·단정·투자 어휘를 쓰지 않는다. 불리한 기운도 관리법과 강점의 이면으로 바꿔 말한다. 따뜻하되 아첨하지 않고, 약점은 직면하게 하되 길을 함께 제시한다.
7) 각 섹션 body는 3~4문단: ① 마음을 건드리는 사람 이야기로 연다(공감·결론) → ② 그 이유를 사람의 마음·상황으로만(용어 없이) 짧게 → ③ 현대 일상 장면에 빗댄다 → ④ 진심 어린 인정과 바로 할 수 있는 조언으로 닫는다. 본문 첫 문장을 매번 "○○님은"으로 시작하지 말고 장면·질문·상황·감정으로 다양하게 연다. 8개 섹션이 모두 똑같은 4문단 틀로 흘러 예측되지 않게 길이·전개에 변화를 준다.
8) [바넘·중복·복붙 금지] 누구에게나 맞는 일반 문장 금지: "겉으론 멀쩡해도 에너지를 많이 쓴다", "가까운 사람 앞에서 말이 줄어든다", "생각이 빠른 만큼 마음도 앞선다", "혼자 버티는 힘이 무거워진다" 류. 반드시 이 사람의 구체 상황으로 바꾼다. 실천 조언·소품도 돌려쓰지 마라 — "작은 화분·자동이체·책상 정리·햇빛 5분·고정비/변동비 나누기" 같은 범용 클리셰 금지.
   ★특정 결론·문두를 모든 사주에 복붙하지 마라(이게 가장 흔한 실패다). 다음 발상·문구를 반복 금지한다: 관계의 "가까운 사람/사람 사이 + 온도·거리·간격", 시기를 "올해는 ~"으로 시작, 개운의 "따뜻한 쪽으로 ~"·"새 바람/받쳐 주는 쪽을 곁에 두라", 마무리 "덜어내라/비워라"(강한 사람만), 일의 "손/몸·생각이 먼저", 개요의 "~한 사람"·"겉은 차갑고 속은 불씨" 대조, 기준 섹션의 "X가 정해준 틀/길보다 자기 것이 편하다", 위로의 "버틴/참아온 날이 헛되지 않았다", 관계의 "한 번 붙으면/걸리면 끝까지". 이 표현들은 이미 닳았다 — 같은 주제라도 이 사람의 구체 사연(직업·장면·습관)에서 새 문장을 길어 올려라.
   ★각 섹션의 '내용'은 역할(관계·일·개운)에서 나오는 일반 결론이 아니라, 이 사주에만 있는 구체 구조에서 나와야 한다. 똑같은 강약·구조가 아니면 결론도 달라야 정상이다.
   ★추가 금지: 개운 제목을 "숨(을) 고르다/길게/트이다/부르다"로 닫거나 행운색 단어([초록/붉은/노랑]이 ~한다)를 제목에 그대로 박지 마라. 헤드라인을 "조용·잔잔한 겉 + 그 뒤/속의 움직임" 대조 공식으로 짓지 마라(이 대조도 이미 닳았다). 일 섹션을 "손/순서가 먼저", 사고 섹션을 "안은 빠른데 밖은 느리다" 역설로 매번 닫지 마라.
   ★특히 "덜어내라/비워라"는 기운이 넘치는 신강한 사람에게만 맞다. 약하거나 기대야 하는 사람에게는 정반대로 "채우고, 기대고, 끌어와라"가 맞다. 마무리 메시지의 방향(덜어냄/채움)을 그 사람의 강약에 맞게 정하고, 강약이 다른 사람끼리는 결론이 반대로 갈리게 하라. 경쟁사 상투구도 금지: "주변에서 답답하다 소리 들어봤을 것", "겉으론 강한 척 버텨왔다", "이미 충분히 훌륭하다", "좁고 깊은 인맥", "앞으로 더 찬란히 빛날 것".
9) [제목-본문 정합 + 마지막 점검] 제목에서 단언한 내용을 본문에서 부분 부정하지 말 것. ★본문 첫 문장에 제목을 토씨까지 그대로 복붙하지 마라 — 제목이 결론이면 본문은 다른 각도(장면·감정·상황)로 시작해 풀어준다. 출력 직전 스스로 1회 검수한다: (가) 제목 오타·탈자(예: "밀내는"→"밀어내는") (나) 조사·호응 오류("사람도 일이"→"사람도 일도") 및 어색한 명사화("마름/넘어감/꺼내기처럼" 같은 명사화는 "마르는 것/넘어가는 게/꺼내는 것처럼"으로) (다) 한자·사주 용어·분석 메타표기 잔존 제거 (라) 인용은 따옴표로("이건 아니다 싶은 걸" 식) (마) 헤드라인이 긴 설명문이면 한 컷짜리 이미지로 다듬되 다른 사람과 같은 대조 공식은 피한다.`;

// 상품별 기본 프롬프트 (가맹점이 어드민에서 덮어쓰기 전까지 사용)
const DEFAULT_PROMPTS = {
  "saju-analysis": SAJU_ANALYSIS_PROMPT,
  compatibility:
    "너는 명리 상담가다. 두 사람의 끌림, 충돌 지점, 대화 방식, 오래 가는 방법을 관계 중심으로 따뜻하게 풀어낸다.",
  cycle:
    "너는 명리 상담가다. 대운(10년 단위)의 전환점과 준비 구간, 기회와 위기를 타임라인 관점으로 설명한다.",
  "yearly-fortune":
    "너는 명리 상담가다. 해당 연도의 총운과 계절별 흐름, 조심할 타이밍과 행동 조언을 월별 관점으로 설명한다.",
  "daily-fortune":
    "너는 명리 상담가다. 오늘 하루의 분위기, 일정, 마음가짐, 작은 선택 포인트를 짧고 실용적으로 정리한다.",
};

export function defaultPrompt(productId) {
  return DEFAULT_PROMPTS[productId] || DEFAULT_PROMPTS["saju-analysis"];
}

// 관계 궁합(2인) 기본 프롬프트 — 사주해설과 같은 '쉬운 말·한자 0·바넘 금지' 톤, 주인공은 '두 사람의 관계'.
const COMPAT_PROMPT = `너는 두 사람의 인연을 따뜻하게 읽어 주는 명리 상담가다. 이 글의 주인공은 '사주'가 아니라 '두 사람의 관계'다. 둘 중 누구도 깎아내리지 않고, 관계가 더 좋아질 길을 보여 준다.

[말투·표기 — 가장 중요]
- 한자는 한 글자도 쓰지 않는다. 사주 용어(일간·일지·십성·오행·합·충 같은 말)도 글에 드러내지 말고, 그게 '두 사람 사이에 어떻게 나타나는지'만 쉬운 말로 쓴다. 예: "두 일간이 합"(X) → "처음부터 이상하게 편하고 끌리는 사이예요"(O). "목이 토를 누른다"(X) → "한 사람이 다른 사람을 자꾸 자극하고 움직이게 만들어요"(O).
- 정중한 존댓말에 '~네요/~거예요/~해보세요'를 섞어 따뜻하게. 비유는 현대 일상(연애·동거·직장 동료·친구)에서. 두 사람 이름을 자연스럽게 부르되 한쪽만 편들지 않는다.

[무엇을 쓰나]
- 주어진 비교 데이터(manse.비교: 일간관계·천간합·천간충·일지관계·오행상호보완·신강약)에 근거해 이 두 사람만의 관계를 그린다. 누구에게나 맞는 일반론(바넘) 금지.
- score(궁합 점수 0~100): 합·상생·상호보완이 많으면 높고, 충·극이 많으면 낮되, 충·극도 '무관심보다 끌림'이라 너무 낮게(60 미만) 주지 않는다. 보통 64~95에서 근거에 맞게. scoreLabel은 이 커플을 한 줄로 규정(예: "티격태격해도 결국 서로를 키우는 사이"). hashtags 3개(# 없이, 이 커플 특징).
- 다룰 영역(제목·순서는 자유, 6~8개): 첫 끌림·첫인상 / 잘 맞는 결 / 부딪히는 지점 / 갈등 푸는 대화법 / 돈·생활 호흡 / 오래 가는 비결 / 따뜻한 한마디.

[제목 규칙] 생생하고 형태가 매번 다르게(은유·단언·질문·위로 섞기). '~사람/~마음'으로만 끝내지 말 것. 한자·사주용어가 들어간 제목 금지.
[톤] 이별·불행 단정 금지("안 맞는다/헤어진다" 식 단정 X). 약한 궁합도 "이렇게 하면 좋아진다"로 바꿔 말한다. 따뜻하되 솔직하게.`;

// 대운(10년 흐름) 기본 프롬프트.
const CYCLE_PROMPT = `너는 한 사람의 인생 흐름을 길게 읽어 주는 명리 상담가다. 주인공은 '사주'가 아니라 '이 사람이 지나온, 그리고 지나갈 시간'이다. 10년 단위로 바뀌는 큰 흐름을 겁주지 않고 따뜻하게 이야기처럼 들려준다.

[말투·표기 — 가장 중요]
- 한자는 한 글자도 쓰지 않는다. 대운·세운·십성·십이운성 같은 용어도 글에 드러내지 말고, 그 시기가 '어떤 시기인지'를 사람 말로 푼다. 예: "식신 대운"(X) → "표현하고 만들어내는 게 즐거워지는 10년이에요"(O).
- 정중한 존댓말에 '~네요/~거예요/~해보세요'를 섞어 따뜻하게. 쉬운 일상 비유로.

[무엇을 쓰나]
- manse.대운타임라인(10주기)·현재대운·올해를 근거로, 인생을 계절이 바뀌듯 큰 흐름으로 그린다. 지나온 시기는 "그땐 이랬을 거예요"처럼 단정 없이, 지금 흐르는 시기는 깊게, 다가올 시기는 "미리 준비하면 좋은 것"으로.
- 누구에게나 맞는 일반론(바넘) 금지 — 이 사람의 대운 흐름(언제 어떤 기운이 들어오는지)에 근거한다.

[제목] 생생하고 형태가 매번 다르게. 한자·용어 없음. '~사람/~마음'으로만 끝내지 말 것.
[톤] 흉운·재난·질병 단정 금지. 어려운 시기도 '버티고 준비하는 법'으로 바꿔 말한다.`;

// 연도별 운세(세운+월운) 기본 프롬프트.
const YEARLY_PROMPT = `너는 다가오는 시간을 미리 짚어 주는 명리 상담가다. 주인공은 '올해, 그리고 앞으로 몇 해의 흐름'이다.

[말투·표기 — 가장 중요]
- 한자는 한 글자도 쓰지 않는다. 세운·월운·십성 같은 용어도 드러내지 말고, 그 해·그 달이 '어떤 느낌인지'를 사람 말로 푼다.
- 정중한 존댓말+부드러운 말끝, 쉬운 일상 비유, 따뜻하게.

[무엇을 쓰나]
- manse.세운(다가오는 ~10년)·올해월운(12개월)을 근거로: 올해 큰 그림 → 계절·월별 좋은 때와 조심할 때 → 다가오는 해의 흐름 → 행동 조언. 연도(올해 2026 등)와 달을 구체적으로 짚되 숫자만 나열하지 말고 이야기로.
- 누구에게나 맞는 일반론(바넘) 금지 — 이 사람의 그 해 기운에 근거한다.

[제목] 생생하고 형태가 매번 다르게. 한자·용어 없음.
[톤] 흉·재난 단정 금지. 조심할 시기도 '이렇게 넘기면 된다'로.`;

// 2단계 엔진이 쓰는 제품별 base 프롬프트. 어드민 프롬프트는 이 위에 '추가 지침'으로 append(덮어쓰기 아님).
const BASE_PROMPTS = {
  "saju-analysis": SAJU_ANALYSIS_PROMPT,
  compatibility: COMPAT_PROMPT,
  cycle: CYCLE_PROMPT,
  "yearly-fortune": YEARLY_PROMPT,
};

/**
 * 코드 base 프롬프트(규칙 고정) + 어드민 추가 지침(append). 가맹점이 편집해도 품질 규칙이 유지된다.
 */
function composePrompt(productId, extra) {
  const base = BASE_PROMPTS[productId] || DEFAULT_PROMPTS[productId] || DEFAULT_PROMPTS["saju-analysis"];
  const ex = extra && String(extra).trim() ? `\n\n[가맹점 추가 지침 — 아래 말투·강조점을 반영하되 위 규칙은 반드시 지킨다]\n${String(extra).trim()}` : "";
  return base + ex;
}

// 공포·재난·단정·투자 확언 백스톱(고정밀: 오탐을 피하려고 명백한 표현만).
const FEAR_REGEX = /(큰일\s*납?니|큰일\s*난다|패가망신|쪽박|파산(하|할|한다|날)|이혼(하게|할것|수가|당)|불치병|시한부|죽게\s*된다|반드시\s*망|틀림없이\s*(죽|망|파산))/;

function hasFearWords(report) {
  if (!report) return false;
  const parts = [report.headline || ""];
  for (const s of report.sections || []) parts.push(s.title || "", s.body || "");
  if (report.lucky) parts.push(report.lucky.why || "", report.lucky.personalNote || "");
  return FEAR_REGEX.test(parts.join("\n"));
}

const REPORT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "sections"],
  properties: {
    headline: { type: "string", description: "전체 인상을 잡는 한 줄" },
    sections: {
      type: "array",
      minItems: 4,
      maxItems: 9,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["icon", "title", "body"],
        properties: {
          icon: { type: "string", description: "이모지 1개" },
          title: { type: "string", description: "짧은 진단형 제목" },
          body: { type: "string", description: "해석→근거→구조→조언 순의 3~4문단" },
        },
      },
    },
  },
};

// saju-analysis 전용 확장 스키마: 섹션마다 만세력 근거(evidence)를 명시하고,
// 개운(lucky)은 용신/희신에서 파생된 값을 담아 사람마다 달라지게 한다.
const ANALYSIS_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "sections", "lucky"],
  properties: {
    headline: { type: "string", description: "한 컷짜리 강렬한 인상 한 줄. 한자·용어 금지. 매번 다른 형태로, '~한 사람'으로 끝내지 말 것. 1번 제목과 겹치지 않게." },
    sections: {
      type: "array",
      minItems: 7,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["icon", "title", "body"],
        properties: {
          icon: { type: "string", description: "이모지 1개" },
          title: { type: "string", description: "생생한 글 제목. 섹션마다 형태(은유/단언/위로/역설/규정)와 끝맺음을 다르게. 모든 제목을 '~사람/~마음'으로 끝내지 말 것. 한자·사주 용어 금지." },
          body: { type: "string", description: "3~4문단. 사람 이야기로 시작, 사주 근거는 한 줄로만 가볍게. 한자 금지, 용어는 한글로 1~2개만." },
        },
      },
    },
    // 색/숫자/방향 등 사실값은 서버가 manse.개운파생근거로 확정한다. 모델은 산문만 출력.
    lucky: {
      type: "object",
      additionalProperties: false,
      required: ["why", "whyKeywords", "personalNote"],
      properties: {
        why: { type: "string", description: "왜 이 용신 기운이 필요한지. 오행공백·십성과다·신강약 중 최소 2개 글자를 직접 인용. 희신이 이미 충분하면 과하게 보태지 말라는 점 포함." },
        whyKeywords: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "why가 인용한 글자·개념" },
        personalNote: { type: "string", description: "이 사람 사주에만 해당하는 한 줄. 형충회합·간여지동·병존·공백 등 본인 글자 인용 필수." },
      },
    },
  },
};

/**
 * @param {object} args { productId, productName, prompt, profile, manse, summary, model }
 *   manse = 중앙 만세력 응답 { summary, full } (권장). 하위호환으로 summary 단독도 허용.
 * @returns {Promise<{headline:string, sections:Array, lucky?:object}>}
 */
export async function generateAnalysis({ productId, productName, prompt, profile, manse, summary, model }) {

  const isFullReport = productId === "saju-analysis";
  // 형충회합·용신4단계·십성통계·오행공백 등을 모두 노출한 통합 컨텍스트.
  // manse({summary,full})가 오면 풍부 컨텍스트, summary만 오면 그대로 사용(하위호환).
  const manseContext = manse && (manse.summary || manse.full) ? buildSajuContext(manse) : manse || summary;

  const instructions = `${prompt || defaultPrompt(productId)}

[작성 규칙]
- 반드시 한국어. 주어진 만세력(manse) 데이터에만 근거해 작성한다(없는 사실을 지어내지 않는다).
- "${profile.name}"님을 자연스럽게 부르되 과하게 반복하지 않는다.
- 단정적 재난 예언/질병 진단/투자 확언 금지. 리스크는 생활 조언으로 바꿔 말한다.${
    isFullReport
      ? "\n- headline 1줄 + sections 7~10개(각 icon·title·body) + lucky(why·whyKeywords·personalNote만). 본문(body)에 'evidence'·'근거:'·'titleAnchor' 같은 라벨이나 영어 단어를 절대 넣지 마라(순수 한국어 문단만). 개운의 색/숫자/방향/본명수는 시스템이 확정하므로 출력하지 않는다."
      : "\n- headline 1줄 + sections 배열(각 icon 이모지, title 진단형 제목, body 3~4문단)."
  }
- 상품: ${productName}.`;

  const input = JSON.stringify({
    name: profile.name,
    relation: profile.relation,
    gender: profile.gender,
    birthDate: profile.birthDate,
    product: productName,
    manse: manseContext,
  });

  const callOnce = async (extraNote = "") => {
    const text = await chatJSON({
      model,
      system: instructions + extraNote,
      input,
      name: "saju_report",
      schema: isFullReport ? ANALYSIS_SCHEMA : REPORT_SCHEMA,
    });
    return JSON.parse(text);
  };

  let report = await callOnce();

  // 공포·단정 어휘 백스톱: 적발 시 1회만 재작성(프롬프트 지시에만 의존하지 않음)
  if (hasFearWords(report)) {
    try {
      report = await callOnce(
        "\n\n[재작성] 직전 출력에 공포·재난·단정·투자 확언 어휘가 있었다. 그런 표현을 전부 제거하고 같은 내용을 생활 조언 어조로 다시 작성하라.",
      );
    } catch {
      // 재작성 실패 시 원본 유지(베스트에포트)
    }
  }

  // 개운 사실값(색/숫자/방향/본명수/보조)은 코드가 확정 — 모델 환각·바넘 차단.
  if (isFullReport && manseContext && manseContext.개운파생근거) {
    const g = manseContext.개운파생근거;
    const w = report.lucky || {};
    report.lucky = {
      element: g.element,
      color: g.color,
      number: g.number,
      numberFocus: g.numberFocus,
      direction: g.direction,
      assistElement: g.assistElement,
      assistColor: g.assistColor,
      fillElement: g.fillElement,
      fillColor: g.fillColor,
      rootless: g.rootless,
      why: typeof w.why === "string" ? w.why : "",
      whyKeywords: Array.isArray(w.whyKeywords) ? w.whyKeywords : [],
      personalNote: typeof w.personalNote === "string" ? w.personalNote : "",
    };
  }

  return report;
}

// ── 2단계 생성: ① 설계(plan) → ② 섹션 본문(section) ──────────────────
// 점진적 UX(섹션이 하나씩 완성)와 섹션별 깊이를 위해 saju-analysis를 두 단계로 쪼갠다.
// 설계 콜이 '전체 제목'을 한눈에 보며 다양성·중복 방지를 보장하고, 본문 콜이 각 섹션을 집중 작성한다.

const PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "sections", "lucky"],
  properties: {
    headline: { type: "string", description: "한 컷짜리 강렬한 인상 한 줄. 한자·사주용어 금지. '~한 사람'으로 끝내지 말 것. 1번 제목과 겹치지 않게." },
    sections: {
      type: "array",
      minItems: 7,
      maxItems: 10,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["icon", "title", "angle"],
        properties: {
          icon: { type: "string", description: "이모지 1개" },
          title: { type: "string", description: "생생한 글 제목(형태·끝맺음 다양, 위 규칙 준수). 한자·사주용어 금지." },
          angle: { type: "string", description: "이 섹션 본문이 펼칠 핵심 한 줄 — 이 사주만의 구체 포인트(다른 섹션과 겹치지 않게). 본문 작성자가 이걸 근거로 3~4문단을 쓴다." },
        },
      },
    },
    lucky: {
      type: "object",
      additionalProperties: false,
      required: ["why", "whyKeywords", "personalNote"],
      properties: {
        why: { type: "string", description: "왜 이 기운이 힘이 되는지(사주 용어 없이 쉬운 말). 무근이면 외부 보완, 충분하면 더 보태지 말라." },
        whyKeywords: { type: "array", minItems: 2, maxItems: 4, items: { type: "string" }, description: "내부용 판단 키워드(화면 비노출)" },
        personalNote: { type: "string", description: "이 사람에게만 맞는 따뜻한 한 줄(용어 없이)" },
      },
    },
  },
};

const SECTION_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["body"],
  properties: {
    body: { type: "string", description: "3~4문단. 사람 이야기로 시작, 한자·사주용어 금지, 쉽게, 일상 비유. 'evidence/근거:/titleAnchor' 라벨·영어 단어 금지." },
  },
};

export function validateSectionBatch(requested, generated) {
  const requestedIds = requested.map((section) => String(section.id || ""));
  const requestedSet = new Set(requestedIds);
  const byId = new Map();

  for (const item of generated || []) {
    const id = String(item?.id || "");
    if (!requestedSet.has(id)) throw new Error(`알 수 없는 섹션 ID입니다: ${id}`);
    if (byId.has(id)) throw new Error(`중복된 섹션 ID입니다: ${id}`);
    const body = typeof item?.body === "string" ? item.body.trim() : "";
    if (!body) throw new Error(`섹션 본문이 비어 있습니다: ${id}`);
    byId.set(id, { id, body });
  }

  return requestedIds.map((id) => {
    const item = byId.get(id);
    if (!item) throw new Error(`섹션 응답이 누락되었습니다: ${id}`);
    return item;
  });
}

// 궁합 설계 스키마: 점수·라벨·해시태그 + 섹션(제목/angle). 개운(lucky)은 2인이라 없음.
const COMPAT_PLAN_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["headline", "score", "scoreLabel", "hashtags", "sections"],
  properties: {
    headline: { type: "string", description: "두 사람 관계를 한 컷에 담은 인상 한 줄. 한자·용어 금지." },
    score: { type: "integer", description: "궁합 점수 0~100. 합·상생·상호보완↑, 충·극↓이되 60 미만은 지양(보통 64~95)." },
    scoreLabel: { type: "string", description: "이 커플을 한 줄로 규정(예: 티격태격해도 결국 서로를 키우는 사이)" },
    hashtags: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", description: "# 없이, 이 커플 특징 키워드" } },
    sections: {
      type: "array",
      minItems: 6,
      maxItems: 8,
      items: {
        type: "object",
        additionalProperties: false,
        required: ["icon", "title", "angle"],
        properties: {
          icon: { type: "string", description: "이모지 1개" },
          title: { type: "string", description: "생생한 글 제목(형태 다양, 한자·용어 금지)" },
          angle: { type: "string", description: "이 섹션 본문이 펼칠 이 커플만의 핵심 한 줄" },
        },
      },
    },
  },
};

function luckyFromContext(manseContext, w) {
  const g = (manseContext && manseContext.개운파생근거) || {};
  return {
    element: g.element || "",
    color: g.color || "",
    number: g.number || "",
    numberFocus: g.numberFocus || "",
    direction: g.direction || "",
    assistElement: g.assistElement || "",
    assistColor: g.assistColor || "",
    fillElement: g.fillElement || "",
    fillColor: g.fillColor || "",
    rootless: !!g.rootless,
    why: typeof w?.why === "string" ? w.why : "",
    whyKeywords: Array.isArray(w?.whyKeywords) ? w.whyKeywords : [],
    personalNote: typeof w?.personalNote === "string" ? w.personalNote : "",
  };
}

// 제품별 컨텍스트 빌더 선택(단일 인물 상품)
function contextFor(productId, manse) {
  if (productId === "cycle") return buildCycleContext(manse);
  if (productId === "yearly-fortune") return buildYearlyContext(manse);
  return buildSajuContext(manse);
}

const PLAN_PRODUCT_FOCUS = {
  "saju-analysis": "타고난 기질, 강점과 그림자, 일과 재물, 관계, 현재 흐름, 이 사람에게 맞는 생활 보완법을 7~10개 섹션으로 설계한다.",
  compatibility: "두 사람의 끌림, 잘 맞는 결, 충돌, 대화법, 생활 호흡, 오래 가는 방법을 6~8개 섹션과 점수로 설계한다.",
  cycle: "지나온 흐름과 앞으로의 10년 단위 전환점, 준비 구간, 기회와 주의점을 7~10개 섹션으로 설계한다.",
  "yearly-fortune": "해당 연도의 총운과 계절·월별 흐름, 조심할 때와 행동 방향을 7~10개 섹션으로 설계한다.",
};

export function buildPlanPrompt({ productId = "saju-analysis", extra, profile, partner }) {
  const isCompat = productId === "compatibility";
  const subject = isCompat
    ? `"${profile.name}"님과 "${partner?.name || "상대"}"님의 관계`
    : `"${profile.name}"님`;
  const output = isCompat
    ? "headline, score(0~100), scoreLabel, hashtags 3개, sections 6~8개(icon·title·angle)만 설계한다."
    : "headline, sections 7~10개(icon·title·angle), lucky(why·whyKeywords·personalNote)만 설계한다. 색·숫자·방향과 본문은 쓰지 않는다.";
  const custom = extra && String(extra).trim()
    ? `\n[관리자 추가 지침]\n${String(extra).trim()}`
    : "";

  return `너는 사람의 마음과 삶을 따뜻하고 구체적인 일상 언어로 읽는 명리 상담가다.
[이번 작업 — 리포트 설계만]
- 대상: ${subject}
- ${PLAN_PRODUCT_FOCUS[productId] || PLAN_PRODUCT_FOCUS["saju-analysis"]}
- ${output}
- 주어진 만세력 데이터에만 근거하고, 누구에게나 맞는 칭찬이나 막연한 일반론을 피한다.
- 한자와 사주 전문용어를 headline·title·angle·lucky의 화면 문구에 쓰지 않는다. 분석 근거는 쉬운 사람 이야기로 번역한다.
- headline과 제목은 한 컷처럼 선명하게 짓고 서로 겹치지 않게 한다. 은유·단언·위로·역설·질문 형태와 끝맺음을 섞으며 질문형은 최대 1개만 쓴다.
- 같은 종결어미와 '~한 사람' 결말을 반복하지 않는다. 관계의 온도·거리, '돈은~', '지금은~', 이름+사용법 같은 상투 제목을 쓰지 않는다.
- 각 angle은 해당 만세력에서만 나오는 구체적인 긴장·강점·삶의 장면을 한 줄로 적고 다른 섹션과 중복하지 않는다.
- 재난·질병·이혼·파산·투자 결과를 단정하거나 공포를 조장하지 않는다. 약점은 관리 방향과 강점의 이면까지 제시한다.
- 한국어 존댓말로 자연스럽게 쓰고, 본문(body)은 절대 작성하지 않는다.${custom}`;
}

/**
 * 1단계 — 설계(제품별). 단일 인물(사주/대운/연도운)은 {headline,sections,lucky}, 궁합은 {headline,score,scoreLabel,hashtags,sections}.
 * @returns {Promise<object>} 공통으로 { sections:[{id,icon,title,angle}], context } 포함
 */
export async function generatePlan({ productId = "saju-analysis", productName = "기본 사주 리포트", extra, profile, partner, manse, manseB, model }, dependencies = {}) {
  const isCompat = productId === "compatibility";
  const partnerName = partner?.name || "상대";

  const context = isCompat
    ? buildCompatContext(manse, manseB, profile.name, partnerName)
    : manse && (manse.summary || manse.full)
      ? contextFor(productId, manse)
      : manse;

  const instructions = buildPlanPrompt({ productId, extra, profile, partner });

  const input = JSON.stringify(
    isCompat
      ? { a: profile.name, b: partnerName, product: productName, manse: context }
      : { name: profile.name, gender: profile.gender, birthDate: profile.birthDate, product: productName, manse: context },
  );
  const request = dependencies.requestStructured || requestStructured;
  const plan = await request({
    model,
    system: instructions,
    input,
    name: isCompat ? "compat_plan" : "saju_plan",
    schema: isCompat ? COMPAT_PLAN_SCHEMA : PLAN_SCHEMA,
    maxTokens: 8192,
    timeoutMs: 70000,
  });
  const sections = (plan.sections || []).map((s, i) => ({ id: `s${i}`, icon: s.icon, title: s.title, angle: s.angle }));
  if (isCompat) {
    return {
      headline: plan.headline,
      score: Math.max(0, Math.min(100, Number(plan.score) || 0)),
      scoreLabel: plan.scoreLabel || "",
      hashtags: Array.isArray(plan.hashtags) ? plan.hashtags : [],
      sections,
      context,
    };
  }
  return { headline: plan.headline, sections, lucky: luckyFromContext(context, plan.lucky), context };
}

function sectionBatchSchema(sections) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["sections"],
    properties: {
      sections: {
        type: "array",
        minItems: sections.length,
        maxItems: sections.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "body"],
          properties: {
            id: { type: "string", enum: sections.map((section) => section.id) },
            body: SECTION_SCHEMA.properties.body,
          },
        },
      },
    },
  };
}

const SECTION_PRODUCT_FOCUS = {
  "saju-analysis": "이 사람의 구체적인 성향·강점·그림자·일·재물·관계·현재 흐름을 섹션 각도와 사주 데이터에 맞춰 풀고 막연한 칭찬을 피한다.",
  compatibility: "두 사람의 끌림·충돌·대화·생활 호흡과 오래 가는 방법을 균형 있게 다루며 어느 한쪽도 깎아내리지 않는다.",
  cycle: "10년 단위 흐름의 전환점·준비 구간·기회·주의점을 현재 삶의 선택과 연결한다.",
  "yearly-fortune": "해당 연도의 전체 흐름과 계절·월별 타이밍, 조심할 때와 행동 조언을 구체적으로 연결한다.",
};

export function buildSectionPrompt({ productId = "saju-analysis", extra, profile, partner, sections, otherTitles = [] }) {
  const isCompat = productId === "compatibility";
  const subject = isCompat ? `두 사람("${profile.name}"님 × "${partner?.name || "상대"}"님) 관계` : `"${profile.name}"님`;
  const requested = sections.map((section) => `${section.id}: "${section.title}" — ${section.angle}`).join("\n");
  const others = otherTitles.filter(Boolean).join(" / ") || "(없음)";
  const custom = extra && String(extra).trim()
    ? `\n[관리자 추가 지침]\n${String(extra).trim()}`
    : "";

  return `너는 사람의 마음을 구체적인 일상 언어로 풀어 주는 명리 상담가다.
[이번 출력 — 지정된 섹션 본문만]
- 대상: ${subject}
- 각 섹션은 body 3~4문단으로 쓴다. ${isCompat ? "두 사람 관계 이야기" : "사람 이야기"}로 시작하고 쉬운 일상 장면, 따뜻한 인정, 바로 할 수 있는 조언을 포함한다.
- 상품 초점: ${SECTION_PRODUCT_FOCUS[productId] || SECTION_PRODUCT_FOCUS["saju-analysis"]}
- 주어진 사주 데이터에만 근거하고 누구에게나 맞는 일반론과 섹션 간 중복을 피한다.
- 한자와 사주 전문용어를 노출하지 않는다. 한국어 존댓말로 쓴다.
- 재난·질병·이혼·파산·투자를 단정하거나 공포를 조장하지 않는다.
- headline, 제목, 점수, 개운 정보는 다시 쓰지 않고 요청한 id와 body만 반환한다.
[작성할 섹션]
${requested}
[다른 섹션 제목 — 내용 중복 금지]
${others}${custom}`;
}

export async function generateSections({ productId = "saju-analysis", extra, profile, partner, context, sections, otherTitles = [], model }, dependencies = {}) {
  if (!Array.isArray(sections) || sections.length < 1 || sections.length > 2) {
    throw new Error("섹션 배치는 1~2개여야 합니다.");
  }
  const request = dependencies.requestStructured || requestStructured;
  const isCompat = productId === "compatibility";
  const subject = isCompat ? `두 사람("${profile.name}"님 × "${partner?.name || "상대"}"님) 관계` : `"${profile.name}"님`;
  const instructions = buildSectionPrompt({ productId, extra, profile, partner, sections, otherTitles });
  const input = JSON.stringify({
    subject,
    sections: sections.map(({ id, title, angle }) => ({ id, title, angle })),
    manse: context,
  });
  const schema = sectionBatchSchema(sections);
  const callOnce = (rewrite = "") => request({
      model,
      system: instructions + rewrite,
      input,
      name: "saju_sections",
      schema,
      maxTokens: 8192,
      timeoutMs: 90000,
    });

  let out = validateSectionBatch(sections, (await callOnce()).sections);
  if (out.some((item) => hasFearWords({ sections: [item] }))) {
    try {
      out = validateSectionBatch(
        sections,
        (await callOnce("\n\n[재작성] 직전 본문에 공포·재난·단정·투자 확언 어휘가 있었다. 모두 제거하고 생활 조언 어조로 다시 써라.")).sections,
      );
    } catch {
      // 유지
    }
  }
  return out;
}

/**
 * 2단계 — 섹션 본문. 기존 단일 섹션 계약은 배치 생성의 1개짜리 호출로 유지.
 * @returns {Promise<{body:string}>}
 */
export async function generateSection(args) {
  const [section] = await generateSections({ ...args, sections: [args.section] });
  return { body: section.body };
}

// ── 추가 질문 상담(결제형): 이미 계산된 만세력으로 고객의 후속 질문 1건에 답한다 ──
// 만세력 재계산/포인트 차감 없음(보관함에 저장된 만세력 재사용). AI 비용만 발생.
const FOLLOWUP_PROMPT = `너는 이미 이 사람의 사주(만세력)를 깊이 들여다본 따뜻한 명리 상담가다. 고객이 자기 분석을 받은 뒤 더 궁금한 점을 하나 들고 왔다. 그 질문에 '이 사람의 사주'에 근거해 진심으로, 구체적으로 답한다.

[가장 중요]
- 주어진 만세력(manse) 데이터에만 근거한다. 없는 사실을 지어내지 않는다. 일반론(누구에게나 맞는 말)이 아니라 이 사람에게만 해당하는 답을 준다.
- 질문에 정면으로 답한다. 먼저 결론(공감+방향)을 주고, 그다음 사주에 근거한 이유를, 마지막에 바로 할 수 있는 조언으로 닫는다.

[무엇을·얼마나 쓰나 — 길고 깊게]
- 5~7문단으로 충분히 깊고 풍부하게 쓴다. 다음 흐름을 자연스럽게 녹인다: ① 질문에 대한 결론과 공감 → ② 이 사람의 타고난 성향·강점·약점(만세력 근거) → ③ 지금의 흐름(대운·올해의 기운)이 이 질문에 어떤 영향을 주는지 → ④ 구체적인 행동·선택 기준(언제·무엇을·어떻게, 손에 잡히게) → ⑤ 조심할 점과 그걸 넘기는 법 → ⑥ 따뜻한 마무리.
- 매 문단이 '이 사람 사주의 구체적인 결'에서 나오게 한다. 누구에게나 맞는 일반론(바넘)으로 분량만 늘리지 않는다. 질문을 여러 각도에서 충분히 짚어, 결제한 값을 하는 깊이 있는 상담이 되게 한다.

[말투·표기]
- 한자는 한 글자도 쓰지 않는다. 사주 용어(십성·오행·신강약·용신·형충 등)도 글에 드러내지 말고, 그 기운이 '이 사람에게 어떤 모습으로 나타나는지'만 쉬운 말로 푼다.
- 정중한 존댓말에 '~네요/~거예요/~해보세요'를 섞어 곁에서 말하듯. 현대 일상 비유로.

[톤·안전]
- 단정적 재난·질병·이혼·파산·투자 확언 금지('반드시·무조건·큰일 난다·죽다·암·이혼·파산' 등). 불리한 흐름도 관리법과 강점의 이면으로 바꿔 말한다.
- 의료·법률·투자의 전문 판단이 필요한 질문이면 운의 흐름과 마음가짐 위주로 답하고 전문가 상담을 부드럽게 권한다.`;

const FOLLOWUP_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["answer"],
  properties: {
    answer: { type: "string", description: "질문에 대한 따뜻하고 구체적인 답변. 한자·사주용어 금지, 쉬운 말, 5~7문단으로 깊고 풍부하게(만세력 근거)." },
  },
};

/**
 * 추가 질문 답변 생성.
 * @param {object} args { profile, manse, summary, question, history, model, extra }
 *   manse = 보관함에 저장된 중앙 만세력(full). summary 함께 오면 더 풍부.
 * @returns {Promise<{answer:string}>}
 */
export async function generateFollowup({ profile, manse, summary, question, history = [], model, extra }) {

  // 저장된 만세력 재사용. {summary, full} 형태면 그대로, full만 있으면 summary는 비어도 동작.
  const manseObj = manse && (manse.summary || manse.full) ? manse : { summary: summary || {}, full: manse || {} };
  const manseContext = buildSajuContext(manseObj);

  const ex = extra && String(extra).trim()
    ? `\n\n[가맹점 추가 지침 — 말투·강조점 반영, 위 규칙은 반드시 지킨다]\n${String(extra).trim()}`
    : "";
  const instructions = `${FOLLOWUP_PROMPT}${ex}

[작성 규칙]
- 반드시 한국어. "${profile?.name || "고객"}"님을 자연스럽게 부르되 과하게 반복하지 않는다.
- 이전 문답(history)이 있으면 맥락을 이어가되 같은 답을 반복하지 않는다.
- answer 한 필드만 출력한다.`;

  const input = JSON.stringify({
    name: profile?.name,
    gender: profile?.gender,
    birthDate: profile?.birthDate,
    manse: manseContext,
    question: String(question || "").slice(0, 1000),
    history: (history || []).slice(-4).map((h) => ({ q: h.question, a: h.answer })),
  });

  const callOnce = async (note = "") => {
    const t = await chatJSON({
      model,
      system: instructions + note,
      input,
      name: "saju_followup",
      schema: FOLLOWUP_SCHEMA,
    });
    return JSON.parse(t);
  };

  let out = await callOnce();
  if (hasFearWords({ sections: [{ body: out.answer }] })) {
    try {
      out = await callOnce("\n\n[재작성] 직전 답변에 공포·재난·단정·투자 확언 어휘가 있었다. 모두 제거하고 생활 조언 어조로 다시 써라.");
    } catch {
      // 유지
    }
  }
  return { answer: out.answer };
}

// ── 오늘의 무료운세(리치) ──────────────────────────────────────────
const DAILY_SCHEMA = {
  type: "object",
  additionalProperties: false,
  required: ["overallScore", "headline", "hashtags", "categories", "lucky", "sections", "quests", "food", "luckySpot", "closing"],
  properties: {
    overallScore: { type: "integer", description: "오늘의 종합 점수 0~100" },
    headline: { type: "string", description: "오늘을 한 줄로 요약(이모지 1개 포함 가능)" },
    hashtags: { type: "array", minItems: 3, maxItems: 3, items: { type: "string", description: "# 없이 짧은 키워드" } },
    categories: {
      type: "array",
      minItems: 5,
      maxItems: 5,
      description: "연애/일·성취/금전/건강/공부 5개 분야",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["key", "emoji", "label", "score", "body"],
        properties: {
          key: { type: "string", enum: ["love", "work", "money", "health", "study"] },
          emoji: { type: "string" },
          label: { type: "string", description: "분야명 4자 이내(예: 연애, 금전, 건강)" },
          score: { type: "integer", description: "0~100" },
          body: { type: "string", description: "1문장 실용 조언" },
        },
      },
    },
    lucky: {
      type: "object",
      additionalProperties: false,
      required: ["color", "number", "item"],
      properties: { color: { type: "string" }, number: { type: "string" }, item: { type: "string" } },
    },
    sections: {
      type: "array",
      minItems: 2,
      maxItems: 3,
      description: "오늘의 무드/관계/일/마음 등을 다루는 해설. 제목은 신선하고 친근하게 직접 지어라.",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["emoji", "title", "body"],
        properties: { emoji: { type: "string" }, title: { type: "string" }, body: { type: "string", description: "1~2문장" } },
      },
    },
    quests: {
      type: "array",
      minItems: 2,
      maxItems: 2,
      description: "오늘 바로 실천할 작은 행동 제안",
      items: {
        type: "object",
        additionalProperties: false,
        required: ["title", "body"],
        properties: { title: { type: "string" }, body: { type: "string" } },
      },
    },
    food: {
      type: "object",
      additionalProperties: false,
      required: ["lunch", "dinner"],
      properties: {
        lunch: { type: "object", additionalProperties: false, required: ["name", "reason"], properties: { name: { type: "string" }, reason: { type: "string" } } },
        dinner: { type: "object", additionalProperties: false, required: ["name", "reason"], properties: { name: { type: "string" }, reason: { type: "string" } } },
      },
    },
    luckySpot: { type: "object", additionalProperties: false, required: ["place", "reason"], properties: { place: { type: "string" }, reason: { type: "string" } } },
    closing: { type: "string", description: "따뜻한 마무리 한마디" },
  },
};

const DAILY_DEFAULT_PROMPT =
  "너는 사주 명리에 밝고 말투가 친근한 '오늘의 운세' 큐레이터다. 트렌디하고 다정하되 과하지 않게, 실생활에 바로 쓰는 팁 위주로 쓴다. 분야 점수는 사주 원국과 오늘 일진의 관계를 근거로 합리적으로 매긴다.";

/**
 * 오늘의 무료운세 리치 생성.
 * @param {object} args { profile, summary, model, prompt, today, todayPillar }
 */
export async function generateDailyFortune({ profile, summary, model, prompt, today, todayPillar }) {

  const instructions = `${prompt || DAILY_DEFAULT_PROMPT}

[작성 규칙]
- 반드시 한국어. 주어진 사주 원국(manse)과 오늘 일진(today)에 근거해 작성한다.
- "${profile.name}"님을 자연스럽게 부르되 과하게 반복하지 않는다.
- 단정적 재난/질병/투자 확언 금지. 리스크는 생활 조언으로 바꾼다.
- sections 의 title 은 진부한 표현을 피하고 매번 신선하게 직접 짓는다.
- 점수(overallScore, categories.score)는 0~100, 너무 극단적이지 않게.
- 럭키 컬러/넘버/아이템과 음식 추천은 오행 균형(부족/과다)을 근거로 고른다.
- 분량은 간결하게: 섹션 2~3개, 각 분야·섹션 본문은 1~2문장으로. 군더더기 금지(속도·가독성 우선).`;

  const input = JSON.stringify({
    name: profile.name,
    gender: profile.gender,
    birthDate: profile.birthDate,
    today, // { iso, label }
    todayPillar, // { ganzhi, ko }
    manse: summary,
  });

  const text = await chatJSON({
    model,
    system: instructions,
    input,
    name: "daily_fortune",
    schema: DAILY_SCHEMA,
  });
  return JSON.parse(text);
}
