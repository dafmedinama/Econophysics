"""
This script contemplates the model published in "Statistical mechanics of money" by A. Dragulescu and V.M. Yakovenko (2000)
"""

import datetime
import random as rn

import numpy as np
import pandas as pd

import helper


def model(money, agents, time, animation=False) -> (np.ndarray, np.ndarray):
    """
    Executes the model

    :param animation: If an animated bar chart is required.
    :param money: Total amount of money in the system.
    :param agents: Total population.
    :param time: Time horizon. Let assume 1 tick = 1 transaction.
    """

    def transaction():
        """
        Simulates a transaction between two agents called 'a' and 'b'. Assign new money belong to 'a' and 'b' after the exchange (delta_money)
        delta_money: Percentage of 'b' 's money to be payed to 'a' for some service.
                     Notice that 'b' always save '1 - delta_money' of its money.
        """
        a = rn.randrange(0, agents)
        b = rn.randrange(0, agents)
        delta_money = rn.random() * money_per_argent[b]
        money_per_argent[a] = money_per_argent[a] + delta_money
        money_per_argent[b] = money_per_argent[b] - delta_money

    # max_money = 0.003  # Maximum amount per agent. Due to some results through multiple simulations, I found that
    # a single agent does not posses more than the 0.3% overtime but this still must be proved somehow.
    # Feel free to modify this value for the bins generation.

    max_money = 0.001  # Just for test

    number_of_bins = 20
    bins = np.arange(0, total_money * max_money, total_money * max_money / (number_of_bins + 1))

    money_per_argent = np.full_like(np.arange(agents, dtype=np.double), money / agents)

    if animation:
        parameters = pd.DataFrame(columns=["Parameter", "Value"],
                                  data=[["population", agents],
                                        ["money", money],
                                        ["time", time],
                                        ]
                                  )
        results = pd.DataFrame()

        for t in range(0, time):
            transaction()
            if t % 100 == 0:
                histogram, _ = np.histogram(money_per_argent, bins)  # Result

                if histogram.sum() < agents:
                    histogram[-1] = agents - histogram.sum() + histogram[-1]

                results[f"{t}"] = histogram

        results = results.T
        results.columns = bins[1:].round(0)
        results.index.name = "t"

        # Save to Excel
        writer = pd.ExcelWriter(f'closed_economic_system_results_animation.xlsx', engine='xlsxwriter')
        parameters.to_excel(writer, sheet_name='Parameters', index=False)
        results.to_excel(writer, sheet_name='Results', index=True)
        writer.save()

        # Generate animated video
        helper.animated_bar_chart(dataframe=results, filename="closed_economic_system_results_animation.mp4")
        return
    else:
        for _ in range(0, time):
            transaction()

    histogram, _ = np.histogram(money_per_argent, bins)  # Result

    return histogram, bins


def simulation(amount, money, agents, time) -> None:
    """

    :param amount: Quantity of simulations to be run
    :param money: Total amount of money in the system.
    :param agents: Total population
    :param time: Time horizon. Let assume 1 tick = 1 transaction.

    """

    results = pd.DataFrame()
    results.index.name = "Bin #"
    bins = []
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

    # Save to Excel
    time_str = datetime.datetime.now().strftime("%d%m%Y_%H%M%S")

    writer = pd.ExcelWriter(f'closed_economic_system_results_{time_str}.xlsx', engine='xlsxwriter')

    parameters.to_excel(writer, sheet_name='Parameters', index=False)
    results.to_excel(writer, sheet_name='Results')

    writer.save()


# Parameters
population = 10000
total_money = 5000000
time_horizon = 100001
simulations = 1

# simulation(simulations, total_money, population, time_horizon)
model(total_money, population, time_horizon, animation=True)
