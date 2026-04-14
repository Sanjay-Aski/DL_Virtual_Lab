# Train a Tiny VGG

This directory includes code and data to train a Tiny VGG model
(inspired by the demo CNN in [Stanford CS231n class](http://cs231n.stanford.edu))
on 10 everyday classes from the [Tiny ImageNet](https://tiny-imagenet.herokuapp.com).

## Installation

First, you want to unzip `data.zip`. The file structure would be something like:

```
.
├── data
│   ├── class_10_train
│   │   ├── n01882714
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n01882714_boxes.txt
│   │   ├── n02165456
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n02165456_boxes.txt
│   │   ├── n02509815
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n02509815_boxes.txt
│   │   ├── n03662601
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n03662601_boxes.txt
│   │   ├── n04146614
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n04146614_boxes.txt
│   │   ├── n04285008
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n04285008_boxes.txt
│   │   ├── n07720875
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n07720875_boxes.txt
│   │   ├── n07747607
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n07747607_boxes.txt
│   │   ├── n07873807
│   │   │   ├── images [500 entries exceeds filelimit, not opening dir]
│   │   │   └── n07873807_boxes.txt
│   │   └── n07920052
│   │       ├── images [500 entries exceeds filelimit, not opening dir]
│   │       └── n07920052_boxes.txt
│   ├── class_10_val
│   │   ├── test_images [250 entries exceeds filelimit, not opening dir]
│   │   └── val_images [250 entries exceeds filelimit, not opening dir]
│   ├── class_dict_10.json
│   └── val_class_dict_10.json
├── data.zip
├── environment.yaml
└── tiny-vgg.py
```

To install all dependencies, run the following code

```
conda env create --file environment.yaml
```

## Training

To train Tiny VGG on these 10 classes, run the following code

```
python tiny-vgg.py
```

After training, you will get two saved models in Keras format: `trained_tiny_vgg.h5`
and `trained_vgg_best.h5`. The first file is the final model after training, and
`trained_vgg_best.h5` is the model having the best validation performance.
You can use either one for CNN Explainer.

## Convert Model Format

Before loading the model using *tensorflow.js*, you want to convert the model file
from Keras `h5` format to [tensorflow.js format](https://www.tensorflow.org/js/tutorials/conversion/import_keras).

```
tensorflowjs_converter --input_format keras trained_vgg_best.h5 ./
```

Then you can put the output file `group1-shard1of1.bin` in `/public/data` and use
*tensorflow.js* to load the trained model.

## Train and Export CAE for MNIST

To train the CAE architecture used by this project and export TensorFlow.js
artifacts directly into the app assets folder, run:

```bash
uv venv --python 3.11 ../.venv-tf
uv pip install --python ../.venv-tf/bin/python tensorflow-cpu==2.16.1 tensorflowjs==4.20.0
../.venv-tf/bin/python train_cae_mnist.py --epochs 12
```

This script exports:

- `public/assets/data/autoencoder-model.json`
- `public/assets/data/autoencoder-shard*.bin`

and writes metadata to:

- `public/assets/data/autoencoder-training-metrics.json`

