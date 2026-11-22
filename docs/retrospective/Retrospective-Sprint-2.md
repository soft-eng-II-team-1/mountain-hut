Retrospective - Sprint 2 (Team 01)
=====================================

The retrospective should include _at least_ the following
sections:

- [Process measures](#process-measures)
- [Quality measures](#quality-measures)
- [General assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done: 4 vs 4
- Total points committed vs done: 20 vs 20
- Nr of hours planned vs spent (as a team): 99h 45m vs -

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed

### Detailed statistics

| Story | # Tasks | Points | Hours est. | Hours actual |
| ----- | ------- | ------ | ---------- | ------------ |
| #0    | 30      | -      | 44h 00m    | -      |
| MH-04 | 9       | 5      | 13h 30m    | 12h 00m      |
| MH-05 | 8       | 2      | 7h         | -      |
| MH-06 | 10      | 5      | 14h 45m    | -      |
| MH-07 | 13      | 8      | 20h 30m    | 21h 10m      |

- Hours per task  <span style="color:red">per person</span>  (average, standard deviation)

| Person           | Mean est. | StDev est. | Mean actual | StDev actual |
| ---------------- | --------- | ---------- | ----------- | ------------ |
| Turco Elisa      | 1h 07m    | 37m        | -      | -          |
| Giusiano Luca    | 0h 59m    | 33m        | -      | -          |
| Azizi Kamyar     | 1h 09m    | 43m        | -      | -          |
| Nannucci Niccolò | 1h 08m    | 35m        | -      | -          |
| Sharma Raghav    | 1h 07m    | 32m        | -      | -          |
| Falorni Sara     | 0h 54m    | 30m        | -      | -          |

- Total task estimation error ratio:

$$
  \frac{\sum_i spent_{task_i}}{\sum_i estimation_{task_i}} - 1 = -
$$

## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated: 8h 00m
  - Total hours spent: 8h 00m
  - Nr of automated unit test cases: -
  - Coverage:

| File                                   | % Stmts   | % Branch  | % Funcs   | % Lines  |
| -------------------------------------- | --------- | --------- | --------- | -------- |
| **All files**                          | **00000** | **00000** | **00000** | **0000** |

- Integration testing:
  - Total hours estimated: 8h 00m
  - Total hours spent: 8h 10m
- E2E testing:
  - Total hours estimated: 4h 30m
  - Total hours spent: -
- Code review: 
  - Total hours estimated: 15h 00m
  - Total hours spent: -

## ASSESSMENT

- What caused your errors in estimation (if any)?
  - Overall, our estimations were quite accurate. The main underestimations were the Sprint Planning meeting (+2h), the backend logic (+1h 45m in total), and the Docker Compose release (+30m), which required more configuration and tuning than expected.

- What lessons did you learn (both positive and negative) in this sprint?
  - A cleaner and more precise task breakdown leads to smoother and easier organization. 
  - Clear communication is essential: when working asynchronously, staying aligned cannot be taken for granted. 

- Which improvement goals set in the previous retrospective were you able to achieve?
  - You Track Agile Boards were cleaner, tidier and easier to navigate. Card titles and descriptions were also standardized.
  - We respected the Definition of Done much more consistently, and rework on completed tasks drastically dropped.
  
- Which ones you were not able to achieve? Why?
  - We still have room to improve in team communication and shared decision-making, mainly because working asynchronously makes it easy for updates or decisions to be missed. 

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)
  - Team coordination needs to be improved, starting from making sure everyone receives, reads and approves decisions. 

- One thing you are proud of as a Team!!
  - We improved in speed, mutual trust and dependency management. There were no idle waiting times between, for example, implementation and testing.
