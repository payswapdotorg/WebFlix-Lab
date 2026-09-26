# Audio Overview

Compile OverviewPlan into a grounded multi-speaker Audio Overview.

Required stages:
OverviewPlan -> DialogueGraph -> AudioTurn[] -> speech -> alignment -> mastering -> QA

Provider-specific protocol belongs in src/providers/audio.
