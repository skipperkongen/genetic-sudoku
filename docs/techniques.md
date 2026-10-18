# Sudoku solving techniques

This list covers the named techniques in common use. It follows the naming used by the main
references: Andrew Stuart's SudokuWiki, the HoDoKu solver and the Sudopedia community wiki.
Techniques are grouped by how hard they are to spot, from the first thing a beginner learns to
methods only puzzle specialists use.

Notation: `r4c6` means row 4, column 6. Boxes are numbered 1–9, left to right and top to bottom.
*Candidates* (pencil marks) are the digits still possible in an empty cell.

✅ means the demo implements, explains and grades with the technique. The demo's tier is shown
in brackets.

## 1. Singles: placing a digit

| | Technique | Idea |
|---|---|---|
| ✅ | Full house (Easy) | A row, column or box has one empty cell left; it gets the missing digit. |
| ✅ | Hidden single (Easy) | Within a row, column or box, a digit fits in only one cell. |
| ✅ | Naked single (Easy) | A cell has only one candidate left. |

## 2. Intersections

| | Technique | Idea |
|---|---|---|
| ✅ | Pointing (Medium) | A digit's candidates in a box all lie on one row or column, so remove it from the rest of that line. Also called locked candidates type 1. |
| ✅ | Claiming (Medium) | A digit's candidates in a row or column all lie in one box, so remove it from the rest of that box. Also called box/line reduction or locked candidates type 2. |

## 3. Subsets

| | Technique | Idea |
|---|---|---|
| ✅ | Naked pair (Medium) | Two cells in a unit share the same two candidates; remove those digits from the rest of the unit. |
| ✅ | Hidden pair (Medium) | Two digits fit in only the same two cells of a unit; remove all other candidates from those cells. |
| ✅ | Naked triple (Hard) | Three cells in a unit hold only three digits between them. |
| ✅ | Hidden triple (Hard) | Three digits fit in only the same three cells of a unit. |
| ✅ | Naked quad (Expert) | The four-cell version. |
| ✅ | Hidden quad (Expert) | The four-digit version. |
| | Locked pair / locked triple | A naked pair or triple that lies in a box and a line at the same time, so it eliminates from both. |

## 4. Basic fish (single digit, rows against columns)

| | Technique | Idea |
|---|---|---|
| ✅ | X-wing (Hard) | In two rows a digit fits in only the same two columns; remove it from the rest of those columns. Also works with rows and columns swapped. |
| ✅ | Swordfish (Hard) | The three-row version. |
| ✅ | Jellyfish (Expert) | The four-row version. |
| | Finned and sashimi fish | A fish with extra "fin" candidates in one box; eliminations are limited to cells that also see the fin. |
| | Franken and mutant fish | Fish whose rows and columns include boxes. |
| | Kraken fish | A fish whose fins are resolved with chains. |

## 5. Single-digit patterns

| | Technique | Idea |
|---|---|---|
| ✅ | Skyscraper (Expert) | Two rows each have a digit in exactly two places, and one end of each lines up in the same column. One of the two other ends must hold the digit, so cells that see both lose it. |
| ✅ | 2-string kite (Expert) | A row and a column each have a digit in exactly two places, and one end of each shares a box. One of the other ends must hold the digit. |
| | Turbot fish | The general four-cell chain behind skyscrapers and kites. |
| | Empty rectangle | A box whose candidates for a digit form an L shape, combined with a two-place row or column. |
| | Simple colouring (singles chains) | Colour a digit's two-place links in two alternating colours and look for contradictions. |
| | Multi-colouring | Simple colouring with several separate colour clusters. |
| | X-chain, X-cycle | Alternating strong and weak links for one digit. |

## 6. Wings

| | Technique | Idea |
|---|---|---|
| ✅ | XY-wing (Expert) | A pivot cell {x,y} sees two cells {x,z} and {y,z}. One of those two must be z, so cells that see both lose z. Also called Y-wing. |
| ✅ | XYZ-wing (Expert) | The same with a pivot {x,y,z}; eliminations must also see the pivot. |
| | WXYZ-wing | Four digits over four cells. |
| | W-wing | Two identical two-candidate cells connected by a two-place link. |

## 7. Chains and loops

| | Technique | Idea |
|---|---|---|
| | Remote pairs | A chain of identical two-candidate cells. |
| | XY-chain | A chain of two-candidate cells, each linked to the next. |
| | Alternating inference chains (AIC), nice loops | General chains of strong and weak links over cells and digits. |
| | Grouped chains | Chains whose links can involve groups of cells. |
| | 3D Medusa | Colouring across several digits at once. |
| | Forcing chains: cell, unit and digit forcing | Follow every option of a cell or unit; anything true in all cases is true. |
| | Nishio, Bowman's bingo | Assume a value and chase the consequences to a contradiction (structured trial and error). |

## 8. Uniqueness methods

These assume the puzzle has exactly one solution.

| | Technique | Idea |
|---|---|---|
| | Unique rectangle, types 1–6 | Avoid four cells in two rows, two columns and two boxes that could swap two digits. |
| | Hidden unique rectangle | The same idea, found from two-place links. |
| | Avoidable rectangle | The same idea, using cells that were solved rather than given. |
| | BUG+1 (bivalue universal grave) | If every unsolved cell but one has two candidates, the odd cell must take the digit that breaks the pattern. |

## 9. Almost locked sets (ALS)

| | Technique | Idea |
|---|---|---|
| | ALS-XZ | Two almost-locked sets linked by a shared restricted digit. |
| | ALS-XY-wing, ALS chain | Three or more ALS linked in a chain. |
| | Death blossom | A stem cell whose candidates each lead to an ALS. |
| | Sue de Coq | Two-sector disjoint subsets at a box/line intersection. |

## 10. Rare and exotic

| | Technique | Idea |
|---|---|---|
| | Aligned pair exclusion | Rules out combinations for two cells that see a common set of cells. |
| | Exocet (junior and senior) | A pattern found in the hardest known puzzles. |
| | SK loop, MSLS | Large multi-sector locked sets. |
| | Pattern overlay, templates | Enumerate every valid placement pattern of a digit. |
| | Gurth's symmetrical placement | Uses the symmetry some puzzles are built with. |

## Not a technique: guessing

Backtracking (trial and error) solves anything but doesn't teach anything. Puzzles in books and
newspapers are built so they never need it. The demo only generates puzzles that its techniques
can solve completely.

## How the demo's levels map to techniques

| Level | Givens | Hardest technique needed |
|---|---|---|
| Easy | 34–38 | Singles |
| Medium | 28–31 | Pointing, claiming, naked or hidden pairs |
| Hard | 24–27 | Triples, X-wing, swordfish |
| Expert | 22–26 | Quads, jellyfish, skyscraper, 2-string kite, XY-wing, XYZ-wing |
