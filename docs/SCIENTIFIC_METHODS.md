# Scientific methods and limits

OpenLab should distinguish deterministic calculations from scientific validation. The molecular workspace operates on the sequence actually loaded by the user; it does not generate fake experimental outcomes.

## Sequence import

- FASTA: one or multiple records; FASTA itself contains no topology metadata, so imported records default to **Linear** until the researcher changes topology.
- GenBank: imports the sequence, supported feature locations/labels and circular/linear topology from the LOCUS line when available.
- CSV/TSV/JSON: recognizes common sequence fields such as `sequence`, `dna`, `nucleotide` and `seq`.
- IUPAC nucleotide symbols are retained where possible. Calculations that require canonical bases treat ambiguous positions conservatively.

## GC content

GC% is calculated from canonical A/C/G/T positions. Ambiguous symbols are excluded from the denominator.

## Restriction sites and digest fragments

The bundled enzyme table uses exact recognition-motif matching for a focused set of common enzymes. Circular matching can cross the origin. Digest fragment lengths are calculated from selected cut positions. This is not a complete commercial restriction-enzyme database and does not model methylation sensitivity, star activity, buffer compatibility or reaction kinetics.

## Primer screening

OpenLab searches 18–28 nt candidates at the selected target boundaries. For oligos shorter than 14 nt it uses the Wallace 2(A+T)+4(G+C) approximation; for common primer lengths it uses an empirical GC/length Tm estimate. It also flags simple GC-range, homopolymer, 3′-end and complementarity heuristics.

These values are useful for first-pass screening only. They are not a nearest-neighbour thermodynamic calculation and do not establish genome-wide specificity. Experimental primer work should be checked with an appropriate validated design/specificity tool and laboratory controls.

## In-silico PCR

The current implementation finds exact forward-primer matches and exact reverse-complement matches and reports compatible products. It does not score mismatches, gaps, off-target genomes or polymerase-specific behavior.

## ORFs and translation

ORF scanning searches both strands for ATG-initiated regions ending at an in-frame TAA/TAG/TGA stop codon above the selected minimum length. Translation uses the standard genetic code. It does not infer non-ATG starts, alternative genetic codes, introns or biological expression.

## Reference data

The bundled pUC19 record is included as a known reference/import test. It must not be described as experimental data produced by OpenLab.
