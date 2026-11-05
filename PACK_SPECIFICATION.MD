pack is a folder, containing:

#pack.json
includes basic metadata for the pack; an object containing:
- "title" - the display name for the pack
- "description" - the displayed description of the pack
- "llm_description" - a description of the pack, given to the ai scorer and roaster
- "icon" - path of the icon for the pack, optional, defaults to "icon.png"
- "tags" - array of tags to display to the player selecting the packs, underneath the description; eg. "thrill"; optional

#descriptions.json
- an dictionary containing the descriptions for each emoji; to be fed into the ai scorer and roaster
- formatted as the keys are the emoji name (eg. "wine_glass": "a glass of red wine")

#transformations.json
- a list of transformations to be applied to each emoji (pre-determined, to ensure they line up properly with the head of the "guy")
formatted as follows:
```{
    "wine_glass": {
        "x": -1,
        "y": 5,
        "r": -3,
        "s": 1
    }
}```
- where x is horizontal translation in px, y is vertical translation in px from the top (positive values move it down), "r" is rotation in degrees, and "s" is a scale value (default 1)
- each property is optional and should default to 0 for rotation and translation, and 1 for scale if not present
- only emojis that need transformations will be specified in transformations.json, use defaults if emoji not present

emojis will be png files placed in "./emojis"
a pack's internal name used in the code will be the name of its folder, formatted in snake_case
