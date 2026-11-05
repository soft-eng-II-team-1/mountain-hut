Retrospective - Sprint 1 (Team 01)
=====================================

The retrospective should include _at least_ the following
sections:

- [Process measures](#process-measures)
- [Quality measures](#quality-measures)
- [General assessment](#assessment)

## PROCESS MEASURES 

### Macro statistics

- Number of stories committed vs done: 3 vs 3
- Total points committed vs done: 16 vs 16
- Nr of hours planned vs spent (as a team): 96h vs 100h 45m

**Remember**  a story is done ONLY if it fits the Definition of Done:
 
- Unit Tests passing
- Code review completed
- Code present on VCS
- End-to-End tests performed

### Detailed statistics

| Story | # Tasks | Points | Hours est. | Hours actual |
| ----- | ------- | ------ | ---------- | ------------ |
| #0    | 23      | -      | 51h 30m    | 53h 45m      |
| MH-01 | 10      | 8      | 16h 30m    | 17h 30m      |
| MH-02 | 16      | 5      | 19h        | 22h 15m      |
| MH-03 | 6       | 3      | 9h         | 7h 15m       |

- Hours per task  <span style="color:red">per person</span>  (average, standard deviation)

| Person           | Mean est. | StDev est. | Mean actual | StDev actual |
| ---------------- | --------- | ---------- | ----------- | ------------ |
| Turco Elisa      | 1h 27m    | 27m        | 1h 21m      | 46m          |
| Giusiano Luca    | 1h 25m    | 28m        | 1h 35m      | 32m          |
| Azizi Kamyar     | 1h 36m    | 26m        | 1h 39m      | 30m          |
| Nannucci Niccolò | 1h 20m    | 31m        | 1h 25m      | 34m          |
| Sharma Raghav    | 1h 02m    | 22m        | 1h 11m      | 38m          |
| Falorni Sara     | 1h 36m    | 29m        | 1h 35m      | 29m          |

- Total task estimation error ratio:

$$
  \frac{\sum_i spent_{task_i}}{\sum_i estimation_{task_i}} - 1 = 0.05
$$

## QUALITY MEASURES 

- Unit Testing:
  - Total hours estimated: 6h
  - Total hours spent: 7h 15m
  - Nr of automated unit test cases: 271
  - Coverage:

| File                                   | % Stmts   | % Branch  | % Funcs   | % Lines  |
| -------------------------------------- | --------- | --------- | --------- | -------- |
| **All files**                          | **93.47** | **90.79** | **92.79** | **94.1** |
| &ensp;config                           | 86.36     | 87.5      | 75        | 86.36    |
| &ensp;&ensp;mailer.js                  | 86.36     | 87.5      | 75        | 86.36    |
| &ensp;dao                              | 89.67     | 84.21     | 92.3      | 91.54    |
| &ensp;&ensp;ReservationDAO.js          | 100       | 95.65     | 100       | 100      |
| &ensp;&ensp;SlotDAO.js                 | 82.82     | 73.68     | 82.6      | 85.71    |
| &ensp;&ensp;TableDAO.js                | 100       | 100       | 100       | 100      |
| &ensp;&ensp;UserDAO.js                 | 80.76     | 80        | 100       | 84       |
| &ensp;&ensp;transaction.js             | 100       | 100       | 100       | 100      |
| &ensp;middlewares                      | 86.11     | 81.81     | 85.71     | 86.11    |
| &ensp;&ensp;auth.js                    | 82.14     | 80        | 80        | 82.14    |
| &ensp;&ensp;validateParams.js          | 100       | 100       | 100       | 100      |
| &ensp;routes                           | 97.57     | 100       | 93.54     | 97.56    |
| &ensp;&ensp;auth.js                    | 100       | 100       | 100       | 100      |
| &ensp;&ensp;reservations.js            | 100       | 100       | 100       | 100      |
| &ensp;&ensp;slots.js                   | 89.58     | 100       | 81.81     | 89.36    |
| &ensp;&ensp;tables.js                  | 100       | 100       | 100       | 100      |
| &ensp;&ensp;warden.js                  | 100       | 100       | 100       | 100      |
| &ensp;services                         | 100       | 94.73     | 100       | 100      |
| &ensp;&ensp;reservationConfirmation.js | 100       | 88.88     | 100       | 100      |
| &ensp;&ensp;tableAssignment.js         | 100       | 100       | 100       | 100      |

- Integration testing:
  - Total hours estimated: 3h
  - Total hours spent: 2h 45m
- E2E testing:
  - Total hours estimated: 3h
  - Total hours spent: 3h
- Code review: 
  - Total hours estimated: 7h 30m
  - Total hours spent: 7h 30m

## ASSESSMENT

- What caused your errors in estimation (if any)?
  - Underestimation of UI Design, especially homepage.
  - Underestimation of some unit tests, especially tests on MH-02 (Define slot capacity).

- What lessons did you learn (both positive and negative) in this sprint?
  - Remember to test every added feature, including those related to uncategorized tasks.
  - Create dedicated tasks for E2E testing.
  - As the project grows, it becomes increasingly important to manage the repository properly and to use separate branches for each feature.

- Which improvement goals set in the previous retrospective were you able to achieve?
  - Time management has improved.
  - Task dependencies were less blocking.
  - Deadline management was better.
  
- Which ones you were not able to achieve? Why?
  - Communication between the members of the group could be improved even more.

- Improvement goals for the next sprint and how to achieve them (technical tasks, team coordination, etc.)
  - Improve planning by creating more precise tasks.
  - Double-check that each task is complete to avoid reworking code.

- One thing you are proud of as a Team!!
  - We split the work in a good way, avoiding last-minute work.