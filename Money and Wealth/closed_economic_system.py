import random as rn

import numpy as np


def simulation(money, amount, agents, time):
    """
    Executes a given amount of simulations.

    :param money: Total amount of money in the system.
    :param amount: Total simulations to be ran.
    :param agents: Total population.
    :param time: Time horizon. Let assume 1 tick <= 1 transaction.
    """

    def transaction():
        """
        Simulates a transaction between two agents called 'a' and 'b'. Assign new money belong to 'a' and 'b' after the
        exchange (delta_money)
        delta_money: Percentage of 'b' 's money to be payed to 'a' for some service.
                     Notice that 'b' always save '1 - delta_money' of its money.
        """
        a = rn.randrange(0, agents)
        b = rn.randrange(0, agents)
        delta_money = rn.random() * money_per_argent[b]
        money_per_argent[a] = money_per_argent[a] + delta_money
        money_per_argent[b] = money_per_argent[b] - delta_money

    max_money = 0.003  # Maximum amount per agent. Due to some results through multiple simulations, I found that
    # a single agent does not posses more than the 0.3% overtime but this still must be proved somehow.
    # Feel free to modify this value for the bins generation.

    bins = np.arange(0, total_money * max_money, total_money / 10 * max_money)
    for i in range(0, amount):
        money_per_argent = np.full_like(np.arange(agents, dtype=np.double), money / agents)
        for j in range(0, time):
            transaction()
        histogram, bin_edges = np.histogram(money_per_argent, bins)  # Result


population = 10000
total_money = 5000
time_horizon = 100000
simulations = 1

simulation(total_money, simulations, population, time_horizon)
