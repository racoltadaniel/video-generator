import json
import re
prompt = """# Instructions

Given the following video script and timed captions, extract three visually concrete and specific keywords for each time segment that can be used to search for background videos. The keywords should be short and capture the main essence of the sentence. They can be synonyms or related terms. If a caption is vague or general, consider the next timed caption for more context. If a keyword is a single word, try to return a two-word keyword that is visually concrete. If a time frame contains two or more important pieces of information, divide it into shorter time frames with one keyword each. Ensure that the time periods are strictly consecutive and cover the entire length of the video. Each keyword should cover between 2-4 seconds. The output should be in JSON format, like this: [[[t1, t2], ["keyword1", "keyword2", "keyword3"]], [[t2, t3], ["keyword4", "keyword5", "keyword6"]], ...]. Please handle all edge cases, such as overlapping time segments, vague or general captions, and single-word keywords.
The most important thing is that all script is covered, so last t2 needs to be %s
For example, if the caption is 'The cheetah is the fastest land animal, capable of running at speeds up to 75 mph', the keywords should include 'cheetah running', 'fastest animal', and '75 mph'. Similarly, for 'The Great Wall of China is one of the most iconic landmarks in the world', the keywords should be 'Great Wall of China', 'iconic landmark', and 'China landmark'.

Important Guidelines:

Use only English in your text queries.
Each search string must depict something visual.
The depictions have to be extremely visually concrete, like rainy street, or cat sleeping.
'emotional moment' <= BAD, because it doesn't depict something visually.
'crying child' <= GOOD, because it depicts something visual.
The list must always contain the most relevant and appropriate query searches.
['Car', 'Car driving', 'Car racing', 'Car parked'] <= BAD, because it's 4 strings.
['Fast car'] <= GOOD, because it's 1 string.
['Un chien', 'une voiture rapide', 'une maison rouge'] <= BAD, because the text query is NOT in English.
  """




def fix_json(json_str):
    # Replace typographical apostrophes with straight quotes
    json_str = json_str.replace("’", "'")
    # Replace any incorrect quotes (e.g., mixed single and double quotes)
    json_str = json_str.replace("“", "\"").replace("”", "\"").replace("‘", "\"").replace("’", "\"")
    # Add escaping for quotes within the strings
    json_str = json_str.replace('"you didn"t"', '"you didn\'t"')
    return json_str

if __name__ == "__main__":
    try:
        
        out = [[[0,0],""]]
        # while out[-1][0][1] != end:
        content = '```json [ [[0:00:00.10, 0:00:04.38], ["programmer at computer", "full-day coding", "intense programming"]], [[0:00:04.38, 0:00:08.36], ["coding without search", "no Google coding", "problem solving"]], [[0:00:08.36, 0:00:13.12], ["random coding", "problem solving", "fixing code"]], [[0:00:13.12, 0:00:17.62], ["learning avoidance", "uncle Ionel", "hero Andreea"]], [[0:00:17.62, 0:00:22.21], ["watching Family Guy", "watching Flash", "favorite activity"]], [[0:00:22.21, 0:00:24.10], ["Family Guy", "Flash TV show", "TV watching"]] ] ```'
        try:
            out = json.loads(content)
        except Exception as e:
            try:
              content = fix_json(content.replace("```json", "").replace("```", ""))
              print(content)
              out = json.loads(content)
            except Exception as e:
              content= re.sub(r'(?<!")(\d+:\d+:\d+\.\d+)(?!")', r'"\1"', content)
              out = json.loads(content)
            print(out)      
        print(out)
    except Exception as e:
        print(e)
