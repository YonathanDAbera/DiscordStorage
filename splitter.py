from filesplit.split import Split
from filesplit.merge import Merge

def split_files(file_path: str, size: int, output_path: str = './temporary/') -> None:
    split = Split(file_path, output_path)
    split.bysize(size)

def merge_files(file_path: str, output_path: str, outputfilename: str) -> None:
    merge = Merge(file_path, output_path, outputfilename)
    merge.merge(True)

