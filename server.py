import asyncio
import websockets
import json
import csv
import os
from datetime import datetime, timezone # Import timezone

CSV_FILENAME = 'gaze_log.csv'
# Updated header with renamed columns
CSV_HEADER = [
    'timestamp', 'participant', 'cardId', 'question',
    'difficulty', 'correct_answer', 'correct_side',
    'participants_side_choice', 'Robot', 'gazeDecision', 'move_duration'
]

# Global dictionary to store records keyed by cardId.
card_records = {}

def initialize_csv_file():
    """
    Create the CSV file with headers if it doesn't already exist.
    Uses the updated CSV_HEADER with renamed columns.
    """
    if not os.path.exists(CSV_FILENAME):
        with open(CSV_FILENAME, 'w', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_HEADER)
            writer.writeheader()
        print(f"CSV file {CSV_FILENAME} created with headers: {CSV_HEADER}")
    else:
        # Optional: Check if existing header matches
        try:
            with open(CSV_FILENAME, 'r', newline='', encoding='utf-8') as csvfile:
                reader = csv.reader(csvfile)
                existing_header = next(reader, None)
                if existing_header and 'move_duration' not in existing_header:
                     print(f"Warning: CSV file exists but is missing the 'move_duration' column. New rows will have it.")
                elif existing_header and ('answer' in existing_header or 'side_choice' in existing_header or 'reveal_to_drop_duration_s' in existing_header):
                     print(f"Warning: CSV file seems to have old column names (e.g., 'answer', 'side_choice'). New data will use: {CSV_HEADER}")
                # Check if length differs OR if sets of headers differ (accounts for order)
                elif len(existing_header) != len(CSV_HEADER) or set(existing_header) != set(CSV_HEADER):
                    print(f"Warning: CSV header mismatch or unexpected columns. Expected {CSV_HEADER}, found {existing_header}. Consider backing up the file.")
                else:
                    print(f"CSV file {CSV_FILENAME} already exists with correct headers.")
        except Exception as e:
            print(f"Could not read existing CSV header: {e}")


def write_combined_record(record):
    """
    Maps internal record keys to the final CSV header keys (including renames),
    adjusts move_duration based on Robot condition (-2s for 'Carl condition'),
    and writes the filtered record to the CSV.
    """
    record_timestamp = record.get('event_arrival_timestamp', datetime.now(timezone.utc))
    record['timestamp'] = record_timestamp.isoformat() # Store as ISO format string

    # --- Adjust move_duration based on Robot condition --- START ---
    carl_condition_identifier = "Carl condition" # <<< MODIFY THIS VALUE AS NEEDED

    robot_condition = record.get('Robot')
    original_duration = record.get('move_duration')
    final_duration = original_duration

    if robot_condition == carl_condition_identifier:
        if isinstance(original_duration, (int, float)):
            final_duration = original_duration - 2.0
            print(f"Adjusting duration for Carl condition (Card {record.get('cardId', 'N/A')}): {original_duration:.3f} -> {final_duration:.3f}")
        else:
            print(f"Cannot adjust duration for Carl condition (Card {record.get('cardId', 'N/A')}): original duration invalid ({original_duration})")
    # --- Adjust move_duration based on Robot condition --- END ---


    # --- Map internal data keys to the final CSV Header keys ---
    filtered_record = {}
    for header_key in CSV_HEADER:
        if header_key == 'timestamp':
            filtered_record[header_key] = record.get('timestamp', '')
        elif header_key == 'correct_answer':
            filtered_record[header_key] = record.get('answer', '') # Map internal 'answer'
        elif header_key == 'participants_side_choice':
            filtered_record[header_key] = record.get('side_choice_raw', '') # Map internal 'side_choice_raw'
        elif header_key == 'move_duration':
            duration_to_format = final_duration # Use the potentially adjusted value
            if isinstance(duration_to_format, (int, float)):
                 filtered_record[header_key] = f"{duration_to_format:.3f}" # Format to 3 decimals
            else:
                 filtered_record[header_key] = '' # Leave blank if not numeric
        elif header_key == 'correct_side':
             filtered_record[header_key] = record.get('side', '') # Map internal 'side'
        else:
            # For other keys, assume header name matches internal key name
            filtered_record[header_key] = record.get(header_key, '')
    # --- End Mapping ---

    # --- CSV Writing Logic ---
    try:
        # Check if file exists to determine if header needs writing
        file_exists = os.path.exists(CSV_FILENAME)
        # Get file size to check if it's empty (relevant if file exists but is empty)
        file_is_empty = file_exists and os.path.getsize(CSV_FILENAME) == 0

        with open(CSV_FILENAME, 'a', newline='', encoding='utf-8') as csvfile:
            writer = csv.DictWriter(csvfile, fieldnames=CSV_HEADER)
            # Write header only if file doesn't exist OR if it exists but is empty
            if not file_exists or file_is_empty:
                 writer.writeheader()
            writer.writerow(filtered_record)
        print(f"Logged combined record for cardId {filtered_record.get('cardId', 'N/A')}")
    except IOError as e:
        print(f"Error writing to CSV file {CSV_FILENAME}: {e}")
    except Exception as e:
        print(f"An unexpected error occurred during CSV writing: {e}")

# --- REMOVED DUPLICATE write_combined_record FUNCTION DEFINITION ---

def record_complete(rec):
    """
    Check if the record contains all required keys using internal key names.
    """
    required = ['cardId', 'side', 'answer', 'question', 'difficulty', 'side_choice_raw', 'Robot', 'gazeDecision']
    has_all_required = all(key in rec for key in required)
    return has_all_required


# Keep track of connected clients.
connected = set()

async def handler(websocket):
    print(f"Client connected: {websocket.remote_address}")
    connected.add(websocket)
    try:
        async for message in websocket:
            arrival_time = datetime.now(timezone.utc)
            log_message = message[:150] + ('...' if len(message) > 150 else '')
            print(f"Message received from {websocket.remote_address} at {arrival_time.isoformat()}: {log_message}")

            try:
                data = json.loads(message)
                card_id = data.get('cardId')
                event_type = data.get('event')
                participant_name = data.get('participant', '')

                if card_id and card_id not in card_records:
                     card_records[card_id] = {}

                if card_id and participant_name:
                     card_records[card_id]['participant'] = participant_name

                if card_id:
                    card_records[card_id]['event_arrival_timestamp'] = arrival_time

                # --- Process cardReveal events ---
                if event_type == 'cardReveal':
                    if card_id:
                         card_records[card_id]['reveal_timestamp'] = arrival_time
                         print(f"Stored reveal timestamp for cardId {card_id}: {arrival_time.isoformat()}")

                         data['side'] = data.get('side')
                         data['answer'] = data.get('answer')
                         card_records[card_id].update(data)

                         # --- FORWARDING cardReveal ---
                         print(f"Forwarding cardReveal for {card_id} to other clients...")
                         for conn in connected.copy():
                            if conn != websocket:
                                try:
                                    await conn.send(message)
                                except websockets.ConnectionClosed:
                                    print(f"Removing closed connection during cardReveal forward: {conn.remote_address}")
                                    connected.remove(conn)
                                except Exception as e:
                                    print(f"Error sending cardReveal message to {conn.remote_address}: {e}")
                         # --- END FORWARDING ---

                         await websocket.send(json.dumps({"status": "cardReveal processed, stored, and forwarded"}))

                    else: # cardReveal missing cardId
                        print("Warning: cardReveal event received without cardId.")
                        await websocket.send(json.dumps({"status": "error", "message": "cardReveal missing cardId"}))
                    continue # Skip further processing below for this message

                # --- Process cardDropped events ---
                elif event_type == 'cardDropped':
                    if card_id and card_id in card_records:
                        drop_time = arrival_time
                        print(f"Processing drop for cardId {card_id} at {drop_time.isoformat()}")

                        data['side_choice_raw'] = data.get('side_choice')
                        card_records[card_id].update(data)

                        reveal_time = card_records[card_id].get('reveal_timestamp')
                        if reveal_time:
                            duration = drop_time - reveal_time
                            duration_seconds = duration.total_seconds()
                            card_records[card_id]['move_duration'] = duration_seconds
                            print(f"Calculated duration for cardId {card_id}: {duration_seconds:.3f}s")
                        else:
                            print(f"Warning: cardDropped received for cardId {card_id}, but no reveal_timestamp found.")
                            card_records[card_id]['move_duration'] = None

                        # ===============================================
                        # == ADDED FORWARDING BLOCK FOR cardDropped =====
                        # ===============================================
                        print(f"Forwarding cardDropped for {card_id} to other clients...")
                        for conn in connected.copy():
                           if conn != websocket: # Don't send back to original sender (sortingGame)
                               try:
                                   print(f"SERVER: Forwarding cardDropped to {conn.remote_address}")
                                   await conn.send(message) # Send the original message string
                               except websockets.ConnectionClosed:
                                   print(f"Removing closed connection during cardDropped forward: {conn.remote_address}")
                                   connected.remove(conn)
                               except Exception as e:
                                   print(f"Error sending cardDropped message to {conn.remote_address}: {e}")
                        # ===============================================
                        # == END OF ADDED FORWARDING BLOCK             ==
                        # ===============================================

                    elif not card_id: # cardDropped missing cardId
                        print("Warning: cardDropped event received without cardId.")
                        await websocket.send(json.dumps({"status": "error", "message": "cardDropped missing cardId"}))
                        continue
                    else: # card_id provided but not in card_records
                         print(f"Warning: cardDropped received for unknown cardId {card_id}. Storing partial data.")
                         data['side_choice_raw'] = data.get('side_choice')
                         card_records[card_id] = data
                         card_records[card_id]['move_duration'] = None
                    # Do NOT 'continue' here, let it fall through to check completion


                # --- Process RobotsMove events ---
                elif event_type == 'RobotsMove':
                     if card_id and card_id in card_records:
                         card_records[card_id].update(data)
                     elif not card_id:
                         print("Warning: RobotsMove event received without cardId.")
                         await websocket.send(json.dumps({"status": "error", "message": "RobotsMove missing cardId"}))
                         continue
                     else: # card_id provided but not in card_records
                         print(f"Warning: RobotsMove received for unknown cardId {card_id}. Storing partial data.")
                         card_records[card_id] = data
                    # Do NOT 'continue' here, let it fall through to check completion


                # --- Check completion and log (now happens after cardReveal, cardDropped, or RobotsMove processing if they don't 'continue') ---
                if card_id and card_id in card_records:
                     if record_complete(card_records[card_id]):
                         print(f"Record complete for cardId {card_id}. Writing to CSV.")
                         write_combined_record(card_records[card_id])
                         del card_records[card_id] # Clean up memory
                         # Send completion status *only* if not triggered by cardReveal
                         if event_type != 'cardReveal':
                              await websocket.send(json.dumps({"status": "combined record logged"}))
                     else:
                         # Send waiting status *only* if not triggered by cardReveal
                         if event_type != 'cardReveal':
                              await websocket.send(json.dumps({"status": f"{event_type} stored; waiting for additional info"}))

                # --- Broadcast any other messages ---
                # Note: cardReveal, cardDropped, RobotsMove will NOT reach here because of checks above
                # or 'continue' statements. Only truly unknown events will be broadcast.
                else: # This covers cases where event_type is not None but isn't one of the handled ones
                     print(f"Broadcasting unhandled known event type or message without event type: {event_type or 'N/A'}")
                     for conn in connected.copy():
                         if conn != websocket:
                             try:
                                 await conn.send(message)
                             except websockets.ConnectionClosed:
                                 print(f"Removing closed connection during broadcast: {conn.remote_address}")
                                 connected.remove(conn)
                             except Exception as e:
                                 print(f"Error broadcasting message to {conn.remote_address}: {e}")


            except json.JSONDecodeError:
                print(f"Error: Received non-JSON message: {message}")
            except Exception as e:
                import traceback
                print(f"Error processing message: {e}")
                print(traceback.format_exc())
                print(f"Problematic Message Content (start): {message[:500]}")

    except websockets.ConnectionClosed as e:
        print(f"Client disconnected: {websocket.remote_address} - Code: {e.code}, Reason: {e.reason}")
    except Exception as e:
        import traceback
        print(f"An unexpected error occurred in the handler: {e}")
        print(traceback.format_exc())

    finally:
        connected.discard(websocket)
        print(f"Connection closed for {websocket.remote_address}. Remaining clients: {len(connected)}")


async def main():
    """
    Main function to start the WebSocket server.
    """
    initialize_csv_file()
    # Use 0.0.0.0 to listen on all available network interfaces
    server = await websockets.serve(handler, "0.0.0.0", 8765)
    print("WebSocket logging server started on ws://0.0.0.0:8765")
    await server.wait_closed() # Changed from asyncio.Future() for cleaner shutdown


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("Server stopped manually.")