# Scale Image Weight Extraction - Implementation Plan

## Overview

Extract jewelry weight from photos of items on digital scales when weight is not provided in the listing title or description.

## Problem

Many eBay sellers don't include weight in their listing text, but they often photograph jewelry on a digital scale. Currently, these listings are processed without melt value calculations because weight is unknown.

## Solution

Use a vision AI (GPT-4V or Claude Vision) to analyze listing images and extract weight readings from scale displays.

## Options

### 1. OpenAI Vision (GPT-4V) - Recommended

Already configured in the system. GPT-4V excels at reading text from images, including scale displays.

**Example prompt:**
```
This is an image of jewelry. If there's a digital scale visible showing a weight reading,
extract the weight value and unit. Return JSON only: {"weight": number, "unit": "g"|"oz"|"dwt"|null, "found": boolean}
If no scale is visible or weight cannot be read, return: {"weight": null, "unit": null, "found": false}
```

**Pros:**
- High accuracy
- Understands context (can differentiate scale from price tags, etc.)
- Handles various scale displays and fonts
- Already integrated

**Cons:**
- Cost: ~$0.01-0.03 per image
- Adds 1-3 seconds latency per image

### 2. Claude Vision

Similar capabilities to GPT-4V, could be used as alternative or fallback.

### 3. Google Cloud Vision OCR

Cheaper but requires more post-processing to parse extracted text.

## Implementation Approach

### Workflow

```
1. Listing found by worker
2. Check if weight exists in title/description
3. If NO weight found:
   a. Fetch listing image URLs from eBay API
   b. Analyze first 3-4 images with vision AI
   c. Look for scale display in each image
   d. Extract weight reading if found
   e. Convert to grams if needed (oz, dwt)
4. Use extracted weight for melt value calculation
5. Cache result to avoid re-processing same listing
```

### Code Changes Required

#### 1. New function: `extractWeightFromImages()`

Location: `worker-node/index.ts`

```typescript
async function extractWeightFromImages(imageUrls: string[]): Promise<{weight: number | null, unit: string | null, source: string}> {
  // Limit to first 4 images (scales usually in early photos)
  const imagesToAnalyze = imageUrls.slice(0, 4);

  for (const imageUrl of imagesToAnalyze) {
    const result = await analyzeImageForScale(imageUrl);
    if (result.found && result.weight) {
      // Convert to grams if needed
      let weightG = result.weight;
      if (result.unit === 'oz') weightG = result.weight * 31.1035;
      if (result.unit === 'dwt') weightG = result.weight * 1.555;

      return { weight: weightG, unit: 'g', source: 'image' };
    }
  }

  return { weight: null, unit: null, source: 'none' };
}
```

#### 2. New function: `analyzeImageForScale()`

```typescript
async function analyzeImageForScale(imageUrl: string): Promise<{found: boolean, weight: number | null, unit: string | null}> {
  const response = await openai.chat.completions.create({
    model: "gpt-4-vision-preview",
    messages: [
      {
        role: "user",
        content: [
          {
            type: "text",
            text: `Analyze this jewelry image. Is there a digital scale visible showing a weight reading?
                   If yes, extract the weight value and unit.
                   Return JSON only: {"found": true/false, "weight": number or null, "unit": "g"|"oz"|"dwt"|null}
                   Common units: g (grams), oz (ounces), dwt (pennyweight)`
          },
          {
            type: "image_url",
            image_url: { url: imageUrl }
          }
        ]
      }
    ],
    max_tokens: 100
  });

  // Parse JSON response
  const content = response.choices[0].message.content;
  return JSON.parse(content);
}
```

#### 3. Modify jewelry processing in `processTask()`

```typescript
// After checking title/description for weight
if (!weight) {
  console.log(`  📷 No weight in text, checking images...`);
  const imageResult = await extractWeightFromImages(item.imageUrls);
  if (imageResult.weight) {
    weight = imageResult.weight;
    console.log(`  📷 Found weight from scale image: ${weight}g`);
  }
}
```

#### 4. Add image URLs to EbayItem interface

Ensure `additionalImages` are fetched from eBay item details.

### Database Changes

Add column to track weight source:
```sql
ALTER TABLE matches_jewelry ADD COLUMN weight_source TEXT DEFAULT 'text';
-- Values: 'text', 'image', 'manual', null
```

## Cost Analysis

| Scenario | Images Analyzed | Cost per Listing |
|----------|-----------------|------------------|
| Weight in text | 0 | $0.00 |
| No weight, scale in 1st image | 1 | ~$0.01 |
| No weight, scale in 3rd image | 3 | ~$0.03 |
| No weight, no scale found | 4 | ~$0.04 |

**Estimated monthly cost:** Depends on volume of listings without text weight.
- If 20% of listings need image analysis: ~$0.02 × 20% × listings/month

## Accuracy Considerations

### High Accuracy Expected For:
- Clear digital scale displays
- Common gram readings (e.g., "5.2g", "12.34")
- Well-lit photos

### Potential Challenges:
- Blurry or low-resolution images
- Unusual scale display fonts
- Reflections/glare on scale screen
- Scale showing in pennyweight (dwt) - less common

### Mitigation:
- Confidence threshold: Only accept readings with high confidence
- Unit validation: Verify unit makes sense (jewelry typically 0.5-100g)
- Human review flag: Mark uncertain readings for manual verification

## Caching Strategy

```typescript
// Cache scale reading results by image URL hash
const scaleReadingCache = new Map<string, {weight: number | null, unit: string | null}>();

// Check cache before API call
const cacheKey = hashImageUrl(imageUrl);
if (scaleReadingCache.has(cacheKey)) {
  return scaleReadingCache.get(cacheKey);
}
```

## Configuration Options

Add to task settings:
```typescript
{
  enable_image_weight_extraction: boolean,  // Default: true
  max_images_to_analyze: number,            // Default: 4
  image_analysis_provider: 'openai' | 'claude',  // Default: 'openai'
}
```

## Testing Plan

1. Collect 20-30 sample listings with scale photos
2. Test accuracy of weight extraction
3. Measure latency impact
4. Calculate actual costs
5. Tune prompts if needed

## Rollout Plan

1. **Phase 1:** Implement with feature flag (disabled by default)
2. **Phase 2:** Enable for test tasks, monitor accuracy
3. **Phase 3:** Enable for all tasks if accuracy > 90%

## Future Enhancements

- Support for analog/dial scales (harder but possible)
- Multi-item detection (multiple pieces on scale)
- Weight range validation based on item type
- Automatic retry with different prompt if reading seems wrong
