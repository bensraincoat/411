## 9/10 Feature report
- The project we're taking on describes a trained model- we need to discuss long term plans and resources available to us from the university in case we need to rent compute
- The most efficient first step was to scaffold the basic project structure, set up the repo, and write some basic documentation
- Right now, this is just a basic React + Flask stack in order to stick closely to the reference material we were provided
	- pg 44 of PowerPoint, pg 32-39 of report
- Moving forward, we need to:
	- Decide on a dataset
	- Discuss which models to use alongside methodology (API vs. local etc)
	- Research if we will need to use additional compute to fine-tune a model ourselves
- After this, we'll begin with model testing and training, implementing and deploying the model, yada yada

#### Notes from docs
- Keras/TensorFlow
- All models mentioned in report:
	- DenseNet-121
	- ResNet 50
	- Xception
	- MobileNetV2
	- InceptionV3
- ResNet-152 - winner in ILSVRC 2015
- Inception-v3 - runner up in ILSVRC 2015
- Datasets mentioned in report:
	- APTOS
	- EyePACS

#### Long-term goals from docs
- Download APTOS 2019 dataset from Kaggle
- Training/fine-tuning a model (Google Colab w GPU typical approach)
- Saving that as a .h5 or .pt file Flask can load

#### Implementation goals
- Flask backend should
	- Load a saved .h5 model file on startup
	- Accept image uploads
	- Preprocess/normalize the image
	- Run interference, return predicted class + confidence