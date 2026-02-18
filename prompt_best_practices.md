# Prompt Best Practices for Storyboard Platform

## Character Anchor Reference Image Prompt

### Key Principles (from Nano Banana Pro best practices):
1. **White/plain background** - essential for consistency and later compositing
2. **Half-body/bust shot** - centered, clear face and upper body
3. **Specific details** - clothing, hair, expression, accessories
4. **Photography style** - lens, lighting, texture specifications
5. **Preserve face consistency** - "keep facial features exactly consistent"

### Template for Character Anchor:
```
A half-body portrait of [CHARACTER_NAME], [CHARACTER_DESCRIPTION].
The character is centered in the frame, facing slightly to the right at a 3/4 angle.
Shot against a pure white studio background with soft, even lighting.
Professional studio photography, shot on 85mm f/1.4 lens.
Soft key light from the upper left, subtle fill light from the right.
Natural skin texture with visible pores, not airbrushed.
Clean catchlights in the eyes.
High detail, 8K resolution, photorealistic.
```

### Template for Scene Anchor:
```
A wide establishing shot of [SCENE_NAME], [SCENE_DESCRIPTION].
Cinematic composition with depth, atmospheric lighting.
The scene conveys [MOOD/ATMOSPHERE].
Shot on 35mm wide-angle lens, golden hour lighting.
High detail, 8K resolution, photorealistic.
No people in the scene, focus on environment and atmosphere.
```

## Storyboard Grid Prompt

### Key Principles:
1. **Reference character images** - pass anchor images as reference
2. **6 panels maximum** - more panels reduce consistency
3. **Each panel has specific description** - camera angle, shot type, action, emotion
4. **Consistent style across panels** - same art style, same characters
5. **Panel layout specification** - "2 rows x 3 columns grid"

### Template for Grid Generation:
```
Create a professional storyboard grid with [ROWS]x[COLS] panels for a [DURATION]-second [GENRE] short film.

Title: [TITLE]
Setting: [SCENE_DESCRIPTION]
Characters: [CHARACTER_LIST_WITH_DESCRIPTIONS]

Panel layout (2 rows x 3 columns):

Panel 1 (top-left): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s
Panel 2 (top-center): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s
Panel 3 (top-right): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s
Panel 4 (bottom-left): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s
Panel 5 (bottom-center): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s
Panel 6 (bottom-right): [SHOT_TYPE], [CAMERA_ANGLE]. [DETAILED_ACTION_DESCRIPTION]. Duration: [X]s

Style: Cinematic storyboard, consistent character appearances across all panels.
Each panel should be clearly separated with thin borders.
Panel numbers visible in the corner of each panel.
Professional film storyboard quality with dynamic compositions.

IMPORTANT: The characters must look EXACTLY the same in every panel - same face, same clothing, same proportions. Reference the provided character images for consistency.
```

## Panel Fix/Inpaint Prompt

### Key Principles:
1. **Reference original panel** - pass the original panel image
2. **Reference anchor images** - pass character/scene anchors for consistency
3. **Specific modification description** - what to change and what to keep
4. **Maintain consistency** - same style, same characters
```
