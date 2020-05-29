# Standard libraries

# Third party imports
import random as rn

import numpy as np

# Local application imports

population = 1000
total_money = 500000
money_per_argent = np.full_like(np.arange(population, dtype=np.double), total_money / population)

time_horizon = 100000  # Amount of time or transactions

for i in range(0, time_horizon):
    a = rn.randrange(0, population)
    b = rn.randrange(0, population)
    delta_money = round(rn.random() * money_per_argent[b],
                        1)  # we assume agent 'b' will pay money to agent 'a' for some service
    if delta_money <= money_per_argent[b]:  # we assume b can't have debt
        money_per_argent[a] = money_per_argent[a] + delta_money
        money_per_argent[b] = money_per_argent[b] - delta_money


# print(money_per_argent)
