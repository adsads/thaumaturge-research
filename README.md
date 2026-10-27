# Thaumaturge Research Helper
Fork of [ythri/tcresearch](https://github.com/ythri/tcresearch) updated for the [Thaumaturge](https://www.curseforge.com/minecraft/mc-mods/thaumaturge) mod (ATM11). The main page is a drag-and-drop hex grid: drop 2+ aspects on it and the gaps fill in (click an aspect chip to mark it as not unlocked). `classic.html` keeps the original From/To finder. The `Thaumaturge` entry in the Version dropdown holds its aspect recipes; older Thaumcraft versions are still selectable. Alkimia has no icon yet (Thaumaturge's art is all-rights-reserved).

[Thaumcraft Research Helper](http://ythri.github.io/tcresearch/)

## Using 
Choose  **`From`** and **`To`** Aspects from your research note and minimum number of steps between those aspects. Then click  **`Find Connection`** and the script will search for the shortest path 
(well, with at least the minimum length) that connects the two aspects.

## Note
Sometimes the length of any path is longer then the given minimum, but this should not be a problem for your research note.

## Disabling aspects
If your are unhappy with the path you got, because you do not have access to those aspects yet or they are quite rare, 
simply disable those aspects from Available Aspects:. The script will then try to find paths without these. Note that 
this may cause the path to grow longer. If too many aspects are disabled and there are no paths left without any of 
those, the script will try to find the shortest path using the minimal number of disabled aspects.
