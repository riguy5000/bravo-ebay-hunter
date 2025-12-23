# Gemstone Scoring System

This document explains how the Deal Score and Risk Score are calculated for gemstone listings.

---

## Deal Score (0-100)

**Higher = Better Deal**

The deal score evaluates how attractive a listing is based on multiple factors.

| Factor | Max Points | Details |
|--------|------------|---------|
| **Match Quality** | 25 | How well the stone matches your task filters |
| **Seller Quality** | 15 | Based on feedback score and positive percentage |
| **Listing Format** | 10 | Best Offer > Fixed Price > Auction |
| **Certification** | 15 | Premium labs score higher |
| **Detail Completeness** | 10 | +2 each for carat, color, clarity, shape, treatment |
| **Natural Stone** | 5 | Bonus if confirmed natural |
| **No Treatment** | 5 | Bonus for untreated colored stones |

### Match Quality Breakdown (0-25 pts)
- Stone type matches filter: +5
- Shape matches filter: +5
- Carat in specified range: +5
- Color matches filter: +5
- Clarity matches filter: +5

### Seller Quality Breakdown (0-15 pts)

**Feedback Score (0-8 pts):**
| Feedback | Points |
|----------|--------|
| 10,000+ | 8 |
| 5,000+ | 7 |
| 1,000+ | 6 |
| 500+ | 5 |
| 100+ | 4 |
| 50+ | 3 |
| 10+ | 2 |
| 1+ | 1 |

**Positive Percentage (0-7 pts):**
| Percentage | Points |
|------------|--------|
| 100% | 7 |
| 99.5%+ | 6 |
| 99%+ | 5 |
| 98%+ | 4 |
| 97%+ | 3 |
| 95%+ | 2 |
| <95% | 0 |

### Listing Format (0-10 pts)
| Format | Points | Reason |
|--------|--------|--------|
| Best Offer | 10 | Room to negotiate |
| Fixed Price | 7 | Clear pricing |
| Auction | 5 | Can be good but risky |
| Unknown | 3 | Default |

### Certification Bonus (0-15 pts)
| Lab Tier | Labs | Points |
|----------|------|--------|
| Premium | GIA, AGS, AGL, Gubelin, SSEF, GRS | 15 |
| Standard | IGI, GCAL, HRD | 10 |
| Budget | EGL, GSI | 5 |
| Generic "certified" | - | 3 |
| None | - | 0 |

---

## Risk Score (0-100)

**Higher = More Risky**

The risk score identifies red flags that suggest a listing may be problematic.

| Red Flag | Points | Trigger |
|----------|--------|---------|
| **Synthetic Flags** | +30 | Title contains: "lab", "synthetic", "created", "cvd", "hpht", "simulant" |
| **No Returns** | +20 | Seller doesn't accept returns |
| **Missing Details** | +5 each | Missing carat, color, clarity, or stone type (max +20) |
| **Heavy Treatments** | +15 | Title contains: "filled", "glass", "lead", "fracture", "diffused", "coated" |
| **Low Feedback Score** | +10 | Seller has <50 feedback |
| **Medium Feedback** | +5 | Seller has 50-99 feedback |
| **Low Positive %** | +5 | Seller below 98% positive |
| **Vague Language** | +10 | Title contains: "estate", "not sure", "i think", "possibly", "maybe", "as is", "no guarantee" |
| **Too Cheap** | +10 | Natural stone priced under $50/carat |

---

## Score Interpretation

### Deal Score Guidelines
| Score | Meaning |
|-------|---------|
| 80-100 | Excellent deal - matches filters well, trusted seller, good cert |
| 60-79 | Good deal - solid listing worth considering |
| 40-59 | Average - may be missing some details or filters |
| 0-39 | Poor match - doesn't align well with your criteria |

### Risk Score Guidelines
| Score | Meaning |
|-------|---------|
| 0-30 | Low risk - listing appears legitimate |
| 31-50 | Moderate risk - some concerns, review carefully |
| 51-70 | High risk - multiple red flags present |
| 71-100 | Very high risk - likely problematic listing |

### Ideal Combinations
| Deal Score | Risk Score | Recommendation |
|------------|------------|----------------|
| ≥70 | ≤30 | Strong buy candidate |
| ≥60 | ≤40 | Worth considering |
| ≥50 | ≤50 | Review carefully |
| Any | >60 | Proceed with caution |

---

## Filtering by Score

You can set score thresholds in your task's gemstone filters:

```json
{
  "min_deal_score": 60,
  "max_risk_score": 50
}
```

This would only save matches with Deal Score ≥60 AND Risk Score ≤50.
