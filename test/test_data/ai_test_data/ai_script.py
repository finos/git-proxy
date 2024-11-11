import tensorflow as tf
model = tf.keras.models.Sequential()
model.add(tf.keras.layers.Dense(10, activation='relu'))
model.compile(optimizer='adam', loss='mse')
