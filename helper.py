"""

"""
import pandas as pd
import bar_chart_race as bcr


def animated_bar_chart(dataframe, filename='video.mp4'):
    bcr.bar_chart_race(
        df=dataframe,
        filename=filename,
        orientation='v',
        # n_bars=6,
        fixed_order=True,
        fixed_max=True,
        steps_per_period=1,
        interpolate_period=False,
        label_bars=True,
        bar_size=.95,
        period_label={'x': .99, 'y': .25, 'ha': 'right', 'va': 'center'},
        period_fmt='t: {x}',
        period_summary_func=lambda v, r: {'x': .99, 'y': .18,
                                          's': '',
                                          'ha': 'right', 'size': 8, 'family': 'Courier New'},
        # perpendicular_bar_func='median',
        period_length=50,
        figsize=(5, 3),
        dpi=144,
        cmap='dark12',
        title='Histogram of distribution of money',
        title_size='',
        bar_label_size=7,
        tick_label_size=7,
        shared_fontdict={'family': 'Helvetica', 'color': '.1'},
        scale='linear',
        writer=None,
        fig=None,
        bar_kwargs={'alpha': .7},
        filter_column_colors=False)
