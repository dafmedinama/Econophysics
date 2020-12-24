import datetime
import random as rn

import numpy as np
import pandas as pd



def model(money, agents, time) -> (np.ndarray, np.ndarray):
    """
    Executes the model

    :param money: Total amount of money in the system.
    :param agents: Total population.
    :param time: Time horizon. Let assume 1 tick = 1 transaction.
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

    number_of_bins = 10
    bins = np.arange(0, total_money * max_money, total_money * max_money / (number_of_bins + 1))

    money_per_argent = np.full_like(np.arange(agents, dtype=np.double), money / agents)
    for j in range(0, time):
        transaction()

    histogram, _ = np.histogram(money_per_argent, bins)  # Result

    return histogram, bins


def simulation(amount, money, agents, time):
    results = pd.DataFrame()
    results.index.name = "Bin #"

    for sim in range(0, amount):
        results[f"Sim_{sim + 1}"], bins = model(money, agents, time)

    results["Bin Edge in unitary money"] = bins[1:]

    parameters = pd.DataFrame(columns=["Parameter", "Value"],
                              data=[["population", agents],
                                    ["money", money],
                                    ["time", time],
                                    ["simulations", simulations]
                                    ]
                              )
    time_str = datetime.datetime.now().strftime("%d%m%Y_%H%M%S")

    writer = pd.ExcelWriter(f'closed_economic_system_results_{time_str}.xlsx', engine='xlsxwriter')

    parameters.to_excel(writer, sheet_name='Parameters', index=False)
    results.to_excel(writer, sheet_name='Results')

    writer.save()


# Parameters
population = 10000
total_money = 50000
time_horizon = 100000
simulations = 1

simulation(simulations, total_money, population, time_horizon)
