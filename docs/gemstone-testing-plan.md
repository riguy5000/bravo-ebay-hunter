# Gemstone Hunter Testing Plan

Comprehensive testing plan for the gemstone scanning feature.

---

## 1. Parser Function Tests

### 1.1 Stone Type Detection
| Test Case | Input Title | Expected Result |
|-----------|-------------|-----------------|
| Basic diamond | "1.5ct Round Diamond GIA" | Diamond |
| Sapphire variant | "Natural Blue Sapphire 2ct" | Sapphire |
| Ruby | "Burma Ruby Oval 1.2 Carat" | Ruby |
| Emerald | "Colombian Emerald Loose Stone" | Emerald |
| Mixed stones | "Ruby and Diamond Ring" | Ruby (primary) |
| No stone type | "Loose Gemstone 2ct Oval" | null |

### 1.2 Carat Extraction
| Test Case | Input | Expected |
|-----------|-------|----------|
| Standard format | "1.5ct Diamond" | 1.5 |
| Carat spelled out | "2 carat sapphire" | 2.0 |
| Decimal | "0.75 ct ruby" | 0.75 |
| From specs | specs: {"Total Carat Weight": "3.00"} | 3.0 |
| From description | desc: "Stone weight: 1.25 carats" | 1.25 |
| TCW format | "TCW 2.5ct" | 2.5 |
| No carat | "Natural Sapphire Oval" | null |
| Invalid (too high) | "500ct diamond" | null (rejected) |

### 1.3 Shape Extraction
| Test Case | Input | Expected |
|-----------|-------|----------|
| Round | "Round Brilliant Diamond" | Round |
| Oval | "Oval Cut Sapphire" | Oval |
| Cushion | "Cushion Modified Ruby" | Cushion |
| Princess | "Princess Cut Diamond 1ct" | Princess |
| Emerald cut | "Emerald Cut Emerald" | Emerald (shape) |
| Pear | "Pear Shape Sapphire" | Pear |
| No shape | "Natural Diamond 1ct" | null |

### 1.4 Color Extraction
| Test Case | Input | Stone Type | Expected |
|-----------|-------|------------|----------|
| Diamond D | "D Color Diamond" | Diamond | D |
| Diamond grade | specs: {"Color": "G"} | Diamond | G |
| Sapphire blue | "Blue Sapphire Ceylon" | Sapphire | Blue |
| Ruby red | "Pigeon Blood Ruby" | Ruby | Red |
| Emerald green | "Vivid Green Emerald" | Emerald | Green |
| Fancy yellow | "Fancy Yellow Diamond" | Diamond | Fancy Yellow |

### 1.5 Clarity Extraction
| Test Case | Input | Expected |
|-----------|-------|----------|
| Diamond VVS1 | "VVS1 Diamond Round" | VVS1 |
| VS2 from specs | specs: {"Clarity": "VS2"} | VS2 |
| Eye clean | "Eye Clean Sapphire" | Eye-Clean |
| Loupe clean | "Loupe Clean Ruby" | Loupe-Clean |
| IF | "Internally Flawless Diamond" | IF |
| SI1 | "SI1 Clarity 1ct Diamond" | SI1 |

### 1.6 Certification Extraction
| Test Case | Input | Expected |
|-----------|-------|----------|
| GIA | "GIA Certified Diamond" | GIA |
| AGS | "AGS Triple Ideal" | AGS |
| IGI | "IGI Report Sapphire" | IGI |
| From specs | specs: {"Certification": "GIA"} | GIA |
| Multiple certs | "GIA IGI Certified" | GIA (first) |
| No cert | "Natural Sapphire 2ct" | null |

### 1.7 Treatment Extraction
| Test Case | Input | Expected |
|-----------|-------|----------|
| Untreated | "Untreated Ruby Natural" | Not Enhanced |
| No heat | "No Heat Sapphire" | Not Enhanced |
| Heat only | "Heat Only Sapphire" | Heat |
| Heated | "Heated Blue Sapphire" | Heat |
| Filled | "Clarity Enhanced Diamond" | Filled |
| Oiled | "Minor Oil Emerald" | Oiled |
| From specs | specs: {"Treatment": "None"} | Not Enhanced |

---

## 2. Scoring Function Tests

### 2.1 Deal Score Calculation
| Scenario | Expected Score Range | Key Factors |
|----------|---------------------|-------------|
| Perfect listing | 85-100 | GIA cert, 10k+ feedback, Best Offer, all details |
| Good listing | 60-84 | Standard cert, good seller, most details |
| Average listing | 40-59 | No cert, medium seller, some missing details |
| Poor listing | 0-39 | No cert, low seller, missing critical info |

**Test Cases:**
```
Test 1: High-quality listing
- Stone: 1.5ct Round Diamond, D/VVS1, GIA certified
- Seller: 15,000 feedback, 99.8% positive
- Format: Best Offer
→ Expected: 80-95

Test 2: Medium-quality listing
- Stone: 2ct Oval Sapphire, Blue, Heat treated, IGI
- Seller: 500 feedback, 99% positive
- Format: Fixed Price
→ Expected: 55-70

Test 3: Low-quality listing
- Stone: Sapphire (no details)
- Seller: 25 feedback, 97% positive
- Format: Auction
→ Expected: 20-40
```

### 2.2 Risk Score Calculation
| Red Flag Combination | Expected Score |
|---------------------|----------------|
| No red flags | 0-10 |
| Missing some details | 10-25 |
| No returns + low feedback | 25-40 |
| Synthetic flags present | 30-50 |
| Multiple red flags | 50-80 |
| All red flags | 80-100 |

**Test Cases:**
```
Test 1: Clean listing
- Natural stone, returns accepted, high seller, all details
→ Expected: 0-15

Test 2: Moderate risk
- Missing clarity, seller 75 feedback, returns accepted
→ Expected: 15-35

Test 3: High risk
- "Lab created" in title, no returns, 20 feedback
→ Expected: 50-70

Test 4: Very high risk
- "Synthetic", no returns, "as is", missing details, <$50/ct
→ Expected: 75-100
```

---

## 3. Blacklist Filter Tests

| Test Case | Title | allow_lab_created | Expected |
|-----------|-------|-------------------|----------|
| CZ simulant | "CZ Diamond Simulant 2ct" | false | BLOCKED |
| Moissanite | "Moissanite Round 1.5ct" | false | BLOCKED |
| Lab diamond allowed | "Lab Created Diamond 1ct" | true | PASSED |
| Lab diamond blocked | "Lab Created Diamond 1ct" | false | BLOCKED |
| Natural stone | "Natural Sapphire Ceylon" | false | PASSED |
| Synthetic sapphire | "Synthetic Blue Sapphire" | false | BLOCKED |
| Glass filled | "Glass Filled Ruby 3ct" | false | BLOCKED |

---

## 4. Multi-Query Search Tests

### 4.1 Query Generation
| Task Filters | Expected Queries |
|--------------|------------------|
| stone_types: [Sapphire], shapes: [Oval] | "natural oval sapphire loose", "oval sapphire gemstone" |
| certifications: [GIA], stone_types: [Diamond] | "GIA diamond loose", "GIA certified diamond" |
| include_jewelry: true, stone_types: [Ruby] | Includes "ruby ring", "ruby pendant" queries |
| carat_min: 2, stone_types: [Emerald] | "2ct emerald", "2 carat emerald loose" |

### 4.2 Deduplication
- Run multiple queries returning overlapping results
- Verify each itemId appears only once in final results
- Verify sorting by listing date (newest first)

---

## 5. Category Filter Tests

| eBay Category ID | Category Name | Should Match |
|------------------|---------------|--------------|
| 262026 | Loose Diamonds & Gemstones | YES |
| 262027 | Loose Gemstones | YES |
| 164694 | Natural Loose Diamonds | YES |
| 10207 | Loose Diamonds | YES |
| 67726 | Fine Rings | Only if include_jewelry=true |
| 261990 | Vintage Jewelry | Only if include_jewelry=true |
| 11700 | Coins | NO |

---

## 6. Database Tests

### 6.1 Migration Verification
```sql
-- Verify all columns exist
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'matches_gemstone'
AND column_name IN ('stone_type', 'treatment', 'is_natural',
                     'classification', 'deal_score', 'risk_score',
                     'dimensions', 'origin', 'carat');
```

### 6.2 Data Integrity
- Verify deal_score is 0-100 integer
- Verify risk_score is 0-100 integer
- Verify is_natural is boolean
- Verify dimensions is valid JSONB
- Verify carat is numeric

### 6.3 Index Performance
```sql
-- Verify indexes exist
SELECT indexname FROM pg_indexes
WHERE tablename = 'matches_gemstone';

-- Test index usage
EXPLAIN ANALYZE
SELECT * FROM matches_gemstone
WHERE deal_score >= 70 AND risk_score <= 30;
```

---

## 7. UI Tests

### 7.1 Task Creation (EnhancedGemstoneFilters)
| Test | Steps | Expected |
|------|-------|----------|
| Filter dropdowns load | Open gemstone task form | Shape, color, clarity dropdowns populate from gems_merged |
| Multi-select works | Select multiple stone types | All selections saved to filters |
| Carat range | Set min=1, max=5 | Values saved correctly |
| Certification checkboxes | Select GIA, AGS | Saved to certifications array |

### 7.2 Matches Display
| Test | Steps | Expected |
|------|-------|----------|
| Gemstone table renders | View matches for gemstone task | See Deal, Risk, Stone, Carat columns |
| Carat displays | Match has carat=2.5 | Shows "2.5ct" |
| Deal score color | Score=75 | Green badge |
| Deal score color | Score=55 | Yellow badge |
| Deal score color | Score=35 | Red badge |
| Risk score color | Score=25 | Green badge |
| Risk score color | Score=45 | Yellow badge |
| Risk score color | Score=70 | Red badge |
| Missing data | No carat saved | Shows "-" |

### 7.3 Real-time Updates
- Start worker with gemstone task
- Keep Matches page open
- Verify new matches appear without refresh

---

## 8. End-to-End Tests

### 8.1 Happy Path
1. Create gemstone task with filters:
   - Stone types: Sapphire, Ruby
   - Shapes: Oval, Round
   - Carat: 1-5
   - Certifications: GIA
   - min_deal_score: 50
   - max_risk_score: 60

2. Run worker
3. Verify:
   - Queries generated correctly
   - Items fetched from eBay API
   - Parsing extracts stone details
   - Scoring calculates correctly
   - Matches saved with all fields
   - Slack notification sent (if configured)
   - UI displays matches with scores

### 8.2 Filter Enforcement
1. Create task with strict filters:
   - Carat: 2-3 only
   - Stone types: Diamond only
   - Certifications: GIA only

2. Run worker
3. Verify items outside filters are skipped with correct reason in logs:
   - "Skipped (Carat X below min 2)"
   - "Skipped (Stone type X not in filter)"
   - "Skipped (Certification X not in filter)"

### 8.3 Error Handling
| Scenario | Expected Behavior |
|----------|-------------------|
| eBay API rate limited | Log warning, skip to next task |
| Invalid API response | Log error, continue processing |
| Database insert fails | Log error, don't crash worker |
| Missing task filters | Use defaults, don't crash |

---

## 9. Performance Tests

### 9.1 Worker Performance
| Metric | Target |
|--------|--------|
| Query execution | <2s per query |
| Item parsing | <50ms per item |
| Scoring calculation | <10ms per item |
| Database insert | <100ms per batch |
| Total task processing | <30s for 200 items |

### 9.2 UI Performance
| Metric | Target |
|--------|--------|
| Matches page load | <2s for 500 matches |
| Filter dropdown load | <1s |
| Real-time update render | <200ms |

---

## 10. Test Execution Checklist

### Pre-release
- [ ] All parser tests pass
- [ ] All scoring tests pass
- [ ] Blacklist correctly blocks simulants
- [ ] Category filtering works
- [ ] Database migration applied
- [ ] UI displays all columns
- [ ] End-to-end flow works
- [ ] Slack notifications work
- [ ] No console errors in UI
- [ ] No unhandled exceptions in worker

### Regression
- [ ] Jewelry tasks still work
- [ ] Watch tasks still work
- [ ] Existing matches display correctly
- [ ] Real-time subscriptions work for all types
