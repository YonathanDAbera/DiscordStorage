from filesplit.split import Split
from filesplit.merge import Merge

trial = Split('What If The Earth Stopped Spinning - Vsauce (1080p, h264, youtube).mp4', '/Users/yabera/Desktop/DiscordStorage/trial/')

trial.bysize(1000000)

merge1 = Merge('/Users/yabera/Desktop/DiscordStorage/trial/','/Users/yabera/Desktop/DiscordStorage/', 'hello.mp4')

merge1.merge(True)

