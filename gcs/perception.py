import asyncio
import json
import cv2
import mediapipe as mp
import websockets

# Initialize MediaPipe FaceMesh
mp_face_mesh = mp.solutions.face_mesh
mp_drawing = mp.solutions.drawing_utils
drawing_spec = mp_drawing.DrawingSpec(thickness=1, circle_radius=1)

# Define a yaw ratio threshold for head direction detection
yaw_ratio_threshold = 0.2


async def face_detection_server(websocket, path=None):  # ✅ FIX: Added `path=None`
    """
    WebSocket server function for real-time face detection using OpenCV and MediaPipe.
    """
    face_mesh = mp_face_mesh.FaceMesh(
        max_num_faces=2,
        refine_landmarks=True,
        min_detection_confidence=0.5,
        min_tracking_confidence=0.5
    )

    cap = cv2.VideoCapture(0)
    if not cap.isOpened():
        print("Error: Could not access webcam.")
        return

    try:
        while True:
            ret, frame = cap.read()
            if not ret:
                print("No frame captured from webcam. Exiting.")
                break

            img_h, img_w, _ = frame.shape
            frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            results = face_mesh.process(frame_rgb)
            faces = results.multi_face_landmarks if results.multi_face_landmarks is not None else []
            face_found = len(faces) > 0

            faceX = None
            faceY = None
            secondFaceX = None
            secondFaceY = None
            head_direction_text = "Looking Forward"

            if face_found:
                face_landmarks = faces[0]
                xs = [lm.x for lm in face_landmarks.landmark]
                ys = [lm.y for lm in face_landmarks.landmark]
                faceX = min(xs) + (max(xs) - min(xs)) / 2
                faceY = min(ys) + (max(ys) - min(ys)) / 2

                if len(faces) > 1:
                    face2 = faces[1]
                    xs2 = [lm.x for lm in face2.landmark]
                    ys2 = [lm.y for lm in face2.landmark]
                    secondFaceX = min(xs2) + (max(xs2) - min(xs2)) / 2
                    secondFaceY = min(ys2) + (max(ys2) - min(ys2)) / 2

                try:
                    left_eye_inner = face_landmarks.landmark[133]
                    right_eye_inner = face_landmarks.landmark[362]
                    baseline_x = (left_eye_inner.x + right_eye_inner.x) / 2
                    nose_tip = face_landmarks.landmark[1]
                    dx = nose_tip.x - baseline_x
                    eye_width = right_eye_inner.x - left_eye_inner.x
                    ratio = dx / eye_width if eye_width != 0 else 0

                    if ratio > yaw_ratio_threshold:
                        head_direction_text = "Looking Right"
                    elif ratio < -yaw_ratio_threshold:
                        head_direction_text = "Looking Left"
                    else:
                        head_direction_text = "Looking Forward"
                except Exception as e:
                    print("Head rotation detection error:", e)
                    head_direction_text = "Looking Forward"

            message = {
                "event": "faceDetection",
                "userInFront": face_found,
                "faceX": faceX,
                "faceY": faceY,
                "secondFaceX": secondFaceX,
                "secondFaceY": secondFaceY,
                "headDirection": head_direction_text
            }
            await websocket.send(json.dumps(message))
            print(f"WebSocket update sent: {message}")

            if face_found:
                for idx, face_landmarks in enumerate(faces):
                    mp_drawing.draw_landmarks(
                        image=frame,
                        landmark_list=face_landmarks,
                        connections=mp_face_mesh.FACEMESH_TESSELATION,
                        landmark_drawing_spec=drawing_spec,
                        connection_drawing_spec=drawing_spec)
                text_x = int(faceX * img_w)
                text_y = int(faceY * img_h) - 30
                cv2.putText(frame, head_direction_text, (text_x, text_y),
                            cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 0, 0), 2)

            cv2.imshow("Perception Debug View", frame)
            if cv2.waitKey(1) & 0xFF == 27:
                break

            await asyncio.sleep(0.03)

    except websockets.exceptions.ConnectionClosedError:
        print("WebSocket connection closed.")
    finally:
        face_mesh.close()
        cap.release()
        cv2.destroyAllWindows()


async def main():
    """
    Main function to start the WebSocket server.
    """
    server = await websockets.serve(face_detection_server, "127.0.0.1", 8766)

    print("WebSocket server started at ws://127.0.0.1:8766")
    await server.wait_closed()


if __name__ == "__main__":
    asyncio.run(main())
