import whisper_timestamped as whisper
from whisper_timestamped import load_model, transcribe_timestamped
import re
import logging


logging.basicConfig(
    filename='/home/dani/workspaces/Text-To-Video-AI2/app.log',            # Log file name
    filemode='a',                  # Append mode
    format='%(asctime)s - %(levelname)s - %(message)s',  # Log format
    level=logging.DEBUG            # Log level (DEBUG for detailed logs)
)


def generate_timed_captions(audio_filename,model_size="base"):
    WHISPER_MODEL = load_model(model_size)
   
    gen = transcribe_timestamped(WHISPER_MODEL, audio_filename, verbose=False, fp16=False)
   
    return getCaptionsWithTime(gen)

def splitWordsBySize(words, maxCaptionSize):
   
    halfCaptionSize = maxCaptionSize / 2
    captions = []
    while words:
        caption = words[0]
        words = words[1:]
        while words and len(caption + ' ' + words[0]) <= maxCaptionSize:
            caption += ' ' + words[0]
            words = words[1:]
            if len(caption) >= halfCaptionSize and words:
                break
        captions.append(caption)
    return captions

def getTimestampMapping(whisper_analysis):
   
    index = 0
    locationToTimestamp = {}
    for segment in whisper_analysis['segments']:
        for word in segment['words']:
            newIndex = index + len(word['text'])+1
            locationToTimestamp[(index, newIndex)] = word['end']
            index = newIndex
    return locationToTimestamp

# def cleanWord(word):
   
#     return re.sub(r'[^\w\s\-_"]', '', word)

def interpolateTimeFromDict(word_position, d):
   
    for key, value in d.items():
        if key[0] <= word_position <= key[1]:
            return value
    return None

def dontIsolateLastWord(CaptionsPairs):
    if len(CaptionsPairs) >= 2:
        last_entry = CaptionsPairs[-1]
        second_last_entry = CaptionsPairs[-2]

        start_time_last, end_time_last = last_entry[0]
        
        start_time_second_last, end_time_second_last = second_last_entry[0]
        duration_last = end_time_last - start_time_last

        if duration_last < 1:
            new_start_time = start_time_second_last
            new_end_time = end_time_last
            new_word = second_last_entry[1] + " " + last_entry[1]
            
            CaptionsPairs[-2] = ((new_start_time, new_end_time), new_word)
            
            CaptionsPairs.pop()
    return CaptionsPairs


def getCaptionsWithTime(whisper_analysis, maxCaptionSize=60, considerPunctuation=False):
   
    wordLocationToTime = getTimestampMapping(whisper_analysis)
    logging.info("location to time %s", wordLocationToTime)
    position = 0
    start_time = 0
    CaptionsPairs = []
    text = whisper_analysis['text']
    
    if considerPunctuation:
        sentences = re.split(r'(?<=[.!?]) +', text)
        words = [word for sentence in sentences for word in splitWordsBySize(sentence.split(), maxCaptionSize)]
    else:
        words = text.split()
        words = [word for word in splitWordsBySize(words, maxCaptionSize)]
    
    for word in words:
        position += len(word) + 1
        end_time = interpolateTimeFromDict(position, wordLocationToTime)
        if end_time and word:
            CaptionsPairs.append(((start_time, end_time), word))
            start_time = end_time

    CaptionsPairs = dontIsolateLastWord(CaptionsPairs)
    return CaptionsPairs



if __name__ == "__main__":
    result = generate_timed_captions("/home/dani/workspaces/Text-To-Video-AI2/audio_tts.wav")